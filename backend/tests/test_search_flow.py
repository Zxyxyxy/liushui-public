"""联网搜索对话行为的离线测试：搜索前不先答、常识问题不受影响、搜索未启用时行为不变。
事实核对（原文片段、数字、年份、重试、兜底）的测试在 tests/test_grounding.py。
运行：cd backend && python3 tests/test_search_flow.py"""
import json, os, sys, tempfile, types, uuid
from pathlib import Path
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
os.chdir(HERE)
os.environ.setdefault('OPENAI_API_KEY', 'sk-test')
os.environ['TAVILY_API_KEY'] = 'tvly-test'
os.environ['ALLOW_OVERSEAS_SEARCH'] = 'true'
os.environ['SEARCH_PROVIDER'] = 'tavily'
os.environ.pop('BOCHA_API_KEY', None)
import db
db.DB_PATH = Path(tempfile.mkdtemp()) / 't.db'
import simple_server as srv
import web_search
from graph import agent
db.init_db()
import auth

ok = True
def check(n, c, e=''):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n, e)

agent._build_tools()
uid = str(uuid.uuid4())
with db._conn() as c:
    c.execute("INSERT INTO users(id,email,password_hash,nickname,invite_code,created_at) VALUES (?,?,?,?,?,?)",
              (uid, 'a@x.com', 'x', 'n', 'c', 'now'))
db.ensure_initial_grant(uid)
h = {"Authorization": "Bearer " + auth.issue_token(uid)}
cl = srv.app.test_client()
def sse(r): return [json.loads(l[6:]) for l in r.get_data(as_text=True).split('\n\n') if l.startswith('data: ')]

class _Fn:
    def __init__(s, n=None, a=None): s.name, s.arguments = n, a
class _TC:
    def __init__(s, i, id=None, fn=None): s.index, s.id, s.function = i, id, fn
class _D:
    def __init__(s, c=None, t=None): s.content, s.tool_calls = c, t
class _Ch:
    def __init__(s, d): s.choices = [types.SimpleNamespace(delta=d)]
class _Resp:
    def __init__(s, t): s.choices = [types.SimpleNamespace(message=types.SimpleNamespace(content=t))]

check('提示词要求先搜后答、搜之前不输出正文', '直接调用搜索' in agent._system_prompt and '调用搜索之前不要输出任何正文' in agent._system_prompt)
check('系统提示词最开头是今天的日期', agent._system_with_date().startswith('今天是 '))

SRC = {"title": "2027年度国考公告", "url": "https://www.scs.gov.cn/a", "site": "国家公务员局",
       "snippet": "报名 10 月 14 日至 24 日", "date": "2026-10-13",
       "content": "网上报名时间为2026年10月14日8:00至10月24日18:00。"}
queries = []
web_search.search = lambda q, count=5: (queries.append(q) or {"ok": True, "error": "", "results": [SRC]})

FACTS = json.dumps({"answerable": True, "lead": "根据官方公告整理如下。",
                    "facts": [{"text": "网上报名时间为2026年10月14日至10月24日", "source": 1,
                               "quote": "网上报名时间为2026年10月14日8:00至10月24日18:00"}],
                    "missing": ""}, ensure_ascii=False)

def create(**kw):
    if kw.get('stream'):
        # 模型先凭记忆说了一段（会自相矛盾的那种），然后调用搜索
        return iter([_Ch(_D(c='2027年国考的日期现在还没公布，预计要到 2026 年 10 月才会公布。')),
                     _Ch(_D(t=[_TC(0, 'c1', _Fn('web_search', '{"query":"2027年国家公务员考试 报名时间"}'))]))])
    return _Resp(FACTS)
agent._executor.client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create)))

evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '2027年国考报名时间'}))
dump = json.dumps(evs, ensure_ascii=False)
check('搜索前凭记忆的那段话没有展示给用户', '还没公布' not in dump and '预计要到' not in dump)
check('最终给出的是核对过的要点', any(e['type'] == 'facts' for e in evs))
check('搜索词带上了问题里的年份', queries and '2027' in queries[0], str(queries))
raw = db.load_messages(evs[-1]['thread_id'])
check('历史里不留搜索前那段话', all('还没公布' not in (m.get('content') or '') for m in raw))

# 不需要搜索的问题：照常回答
def plain(**kw):
    return iter([_Ch(_D(c='国考一般分')), _Ch(_D(c='行政职位和公安职位等类别。'))])
agent._executor.client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=plain)))
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '国考分几类'}))
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('常识性问题不搜索，回答完整', text == '国考一般分行政职位和公安职位等类别。', text)
check('常识性问题没有搜索和核对步骤', not any(e['type'] == 'step' for e in evs))

# 搜索没启用时：行为和以前完全一致
os.environ.pop('TAVILY_API_KEY'); os.environ.pop('SEARCH_PROVIDER')
agent._build_tools()
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '国考分几类'}))
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('搜索未启用：回答不受影响', text == '国考一般分行政职位和公安职位等类别。')
check('搜索未启用：不注册搜索工具', not any(t['function']['name'] == 'web_search' for t in agent._tools))
check('搜索未启用：提示词声明没有联网能力', '没有联网能力' in agent._system_prompt)

print('\nALL PASS' if ok else '\nSOME FAILED')
sys.exit(0 if ok else 1)
