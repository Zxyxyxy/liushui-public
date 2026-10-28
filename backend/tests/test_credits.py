"""积分服务端化的离线测试（临时数据库、模拟模型，不出网、不碰真实数据）。
运行：cd backend && python3 tests/test_credits.py"""
import json, os, sys, tempfile, threading, types, uuid
from pathlib import Path
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
os.chdir(HERE)
os.environ.setdefault('OPENAI_API_KEY', 'sk-test')
for k in ('BOCHA_API_KEY', 'TAVILY_API_KEY', 'SEARCH_PROVIDER', 'ALLOW_OVERSEAS_SEARCH'):
    os.environ.pop(k, None)
import db
db.DB_PATH = Path(tempfile.mkdtemp()) / 't.db'
import simple_server as srv
db.init_db()
from graph import agent
import auth

ok = True
def check(n, c, e=''):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n, e)

def mk(email, grant=True):
    uid = str(uuid.uuid4())
    with db._conn() as c:
        c.execute("INSERT INTO users(id,email,password_hash,nickname,invite_code,created_at) VALUES (?,?,?,?,?,?)",
                  (uid, email, 'x', 'n', 'c', 'now'))
    if grant: db.ensure_initial_grant(uid)
    return uid, {"Authorization": "Bearer " + auth.issue_token(uid)}
cl = srv.app.test_client()
def sse(r): return [json.loads(l[6:]) for l in r.get_data(as_text=True).split('\n\n') if l.startswith('data: ')]

ua, ha = mk('a@x.com'); ub, hb = mk('b@x.com')

check('初始积分发放', db.get_balance(ua) == db.INITIAL_CREDITS, str(db.get_balance(ua)))
db.ensure_initial_grant(ua); db.ensure_initial_grant(ua)
check('初始积分只发一次（幂等）', db.get_balance(ua) == db.INITIAL_CREDITS)
check('两个账号余额互不影响', db.get_balance(ub) == db.INITIAL_CREDITS)
check('未登录取不到余额 401', cl.get('/api/credits').status_code == 401)
r = cl.get('/api/credits', headers=ha).get_json()
check('接口返回余额与流水', r['balance'] == 200 and r['ledger'][0]['title'] == '新用户体验积分' and r['spent'] == 0)

from db import register_user
db.create_invite_codes(1, 5, 't'); code = [x for x in db.invite_stats()][0]['code']
u = register_user('new@x.com', 'h', 'new', code)
check('新注册账号自带初始积分', db.get_balance(u['id']) == 200)

db.spend_credits(ua, 20, 't', 'r1')
check('扣费', db.get_balance(ua) == 180)
db.spend_credits(ua, 20, 't', 'r1')
check('同一 ref 重复扣费不重复记账', db.get_balance(ua) == 180)
try:
    db.spend_credits(ua, 9999, 't', 'big'); check('余额不足应被拒', False)
except db.InsufficientCredits as e:
    check('余额不足被拒且不记账', db.get_balance(ua) == 180 and e.balance == 180)
db.refund_credits(ua, 'r1', 'x'); db.refund_credits(ua, 'r1', 'x')
check('退款恢复余额，重复退款只退一次', db.get_balance(ua) == 200)
db.refund_credits(ua, 'never-charged', 'x')
check('没扣过的 ref 退不出钱', db.get_balance(ua) == 200)
check('累计消耗按净额算', db.spent_total(ua) == 0)

uc, hc = mk('c@x.com')
res = []
def go(i):
    try: db.spend_credits(uc, 20, 't', f'c{i}'); res.append(1)
    except db.InsufficientCredits: res.append(0)
ts = [threading.Thread(target=go, args=(i,)) for i in range(30)]
[t.start() for t in ts]; [t.join() for t in ts]
check('并发扣费：恰好成功 10 次', sum(res) == 10, str(sum(res)))
check('并发扣费：余额为 0，不会变负', db.get_balance(uc) == 0)

from skill_executor import SkillResult
body = {'run_skill': {'skill_id': 'jd-match', 'fields': {'resume': {'text': 'r'}, 'jd': {'text': 'j'}}}}
cost = srv.skills_dict['jd-match'].credits
srv.skill_executor.execute = lambda sid, p, max_tokens=8000: SkillResult(True, '## ok', 20)
b0 = db.get_balance(ua)
evs = sse(cl.post('/api/chat/stream', headers=ha, json=body))
check('成功运行：扣费一次', db.get_balance(ua) == b0 - cost and evs[-1]['type'] == 'done', f'{b0}->{db.get_balance(ua)}')
check('done 带服务端余额', evs[-1]['balance'] == db.get_balance(ua))
led = cl.get('/api/credits', headers=ha).get_json()['ledger']
check('流水里有「运行 xxx」', any('运行' in l['title'] and l['amount'] == -cost for l in led))

srv.skill_executor.execute = lambda sid, p, max_tokens=8000: SkillResult(False, '', 0, error='模型超时')
b1 = db.get_balance(ua)
evs = sse(cl.post('/api/chat/stream', headers=ha, json=body))
check('执行失败：积分全额退回', db.get_balance(ua) == b1 and evs[-1]['type'] == 'error', f'{b1}->{db.get_balance(ua)}')
check('执行失败：流水里有退款记录', any(l['kind'] == 'refund' for l in db.list_ledger(ua)))

def boom(*a, **k): raise RuntimeError('崩了')
srv.skill_executor.execute = boom
b2 = db.get_balance(ua)
sse(cl.post('/api/chat/stream', headers=ha, json=body))
check('执行抛异常：积分退回', db.get_balance(ua) == b2)

srv.skill_executor.execute = lambda sid, p, max_tokens=8000: SkillResult(True, '## ok', 20)
b3 = db.get_balance(ua)
resp = cl.post('/api/chat/stream', headers=ha, json=body, buffered=False)
it = iter(resp.response); next(it)
resp.close()
check('中途取消：积分退回', db.get_balance(ua) == b3, f'{b3}->{db.get_balance(ua)}')

called = {'n': 0}
srv.skill_executor.execute = lambda sid, p, max_tokens=8000: (called.__setitem__('n', called['n'] + 1) or SkillResult(True, 'x', 1))
evs = sse(cl.post('/api/chat/stream', headers=hc, json=body))
check('余额不足：拒绝并提示余额', evs[0]['type'] == 'error' and '积分不足' in evs[0]['message'], evs[0].get('message'))
check('余额不足：没有调用模型，余额仍为 0', called['n'] == 0 and db.get_balance(uc) == 0)

before = db.get_balance(ua)
cl.post('/api/chat/stream', headers=ha, json={**body, 'credits': 99999, 'balance': 99999})
check('请求体里的 credits 字段被忽略', db.get_balance(ua) <= before)

b4 = db.get_balance(ua)
class _Fn:
    def __init__(s, n=None, a=None): s.name, s.arguments = n, a
class _TC:
    def __init__(s, i, id=None, fn=None): s.index, s.id, s.function = i, id, fn
class _D:
    def __init__(s, c=None, t=None): s.content, s.tool_calls = c, t
class _Ch:
    def __init__(s, d): s.choices = [types.SimpleNamespace(delta=d)]
agent._executor.client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(
    create=lambda **kw: iter([_Ch(_D(t=[_TC(0, 'c1', _Fn('run_jd_match', '{"resume":"r","jd":"j"}'))]))]))))
sse(cl.post('/api/chat/stream', headers=ha, json={'message': '匹配'}))
check('模型只给表单时不扣积分', db.get_balance(ua) == b4)

print('\nALL PASS' if ok else '\nSOME FAILED')
sys.exit(0 if ok else 1)
