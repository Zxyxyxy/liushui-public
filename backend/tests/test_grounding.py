"""联网回答事实核对的离线测试（不出网、模拟模型）。运行：cd backend && python3 tests/test_grounding.py

重点验证：编造的引用、年份被顺延、数字对不上、资料不足，都不会出现在给用户的回答里。"""
import json, os, sys, tempfile, types, uuid
from pathlib import Path
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
os.chdir(HERE)
import grounding as g

ok = True
def check(n, c, e=''):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n, e)

SRC = [
    {"title": "2027年度国考公告", "site": "国家公务员局", "date": "2026-10-13", "url": "https://www.scs.gov.cn/a",
     "content": "中央机关及其直属机构2027年度考试录用公务员公告。网上报名时间为2026年10月14日8:00至10月24日18:00。"
                "公共科目笔试时间为2026年11月29日。报名确认和缴费时间为11月1日至11月6日。"},
    {"title": "备考指南", "site": "example.cn", "date": "", "url": "http://example.cn/b",
     "content": "国考一般在每年10月中旬发布公告，笔试在11月底或12月初的周日举行。"},
]

# ── 规整与数字 ──
check('全角/半角、空格、标点规整后可比', g._norm("2026年10月14日 8：00") == g._norm("2026年10月14日8:00"))
check('数字抽取去前导零', g._numbers("2026-09-05") == ["2026", "9", "5"])
check('中文数字转阿拉伯', g._numbers("十月二十四日") == ["10", "24"] and g._numbers("二〇二六年") == ["2026"])
check('「一般」「统一」「一起」「第一」里的一不算数字', g._numbers("国考一般统一安排，一起备考，第一阶段") == [])
check('单个中文数字后面跟单位才算数字', g._numbers("三月五日考两天") == ["3", "5", "2"])
check('「十分重要」不算数字，「十分钟」算', g._numbers("十分重要") == [] and g._numbers("十分钟") == ["10"])

general = {"facts": [{"text": "国考一般在10月中旬发布公告", "source": 2,
                      "quote": "国考一般在每年10月中旬发布公告"}]}
p, pr = g.verify(general, SRC)
check('陈述里有「一般」：不被误判多出数字', len(p) == 1, str(pr))
check('开场白里有「一起」：不被误删', g.clean_note("我们一起看看。") == "我们一起看看。")

# ── 正常通过 ──
data = {"answerable": True, "lead": "根据国家公务员局的公告，整理如下。",
        "facts": [{"text": "网上报名时间为2026年10月14日至10月24日", "source": 1,
                   "quote": "网上报名时间为2026年10月14日8:00至10月24日18:00"},
                  {"text": "公共科目笔试在2026年11月29日", "source": 1, "quote": "公共科目笔试时间为2026年11月29日"}],
        "missing": ""}
passed, problems = g.verify(data, SRC)
check('原文逐字、数字都在：通过', len(passed) == 2 and not problems, str(problems))

# ── 你遇到的那类错误 ──
bad_year = {"facts": [{"text": "网上报名时间为2027年10月14日至10月24日", "source": 1,
                       "quote": "网上报名时间为2026年10月14日8:00至10月24日18:00"}]}
p, pr = g.verify(bad_year, SRC)
check('年份被顺延（原文 2026、陈述写 2027）：剔除', not p and '2027' in pr[0], str(pr))

fabricated = {"facts": [{"text": "笔试在2027年11月28日", "source": 1, "quote": "公共科目笔试时间为2027年11月28日"}]}
p, pr = g.verify(fabricated, SRC)
check('引用片段是编的（原文里没有）：剔除', not p and '找不到' in pr[0], str(pr))

wrong_src = {"facts": [{"text": "笔试在2026年11月29日", "source": 2, "quote": "公共科目笔试时间为2026年11月29日"}]}
p, pr = g.verify(wrong_src, SRC)
check('张冠李戴（引用了别的资料里的话）：剔除', not p, str(pr))

extra_num = {"facts": [{"text": "网上报名持续10天，共招录3万人", "source": 1,
                        "quote": "网上报名时间为2026年10月14日8:00至10月24日18:00"}]}
p, pr = g.verify(extra_num, SRC)
check('陈述里多出原文没有的数字（3万人）：剔除', not p and '3' in pr[0], str(pr))

stitched = {"facts": [{"text": "报名截至10月24日，笔试11月29日", "source": 1,
                       "quote": "至10月24日18:00。公共科目笔试时间为2026年11月29日"}]}
p, _ = g.verify(stitched, SRC)
check('相邻两句连着摘：只要原文里连续出现就通过', len(p) == 1)

jumbled = {"facts": [{"text": "报名截至10月24日，缴费到11月6日", "source": 1,
                      "quote": "网上报名时间为至10月24日，缴费时间为11月1日至11月6日"}]}
p, _ = g.verify(jumbled, SRC)
check('把不相邻的句子拼在一起：剔除', not p)

tiny = {"facts": [{"text": "10月", "source": 1, "quote": "10月"}]}
p, pr = g.verify(tiny, SRC)
check('片段太短证明不了什么：剔除', not p)

no_src = {"facts": [{"text": "笔试在2026年11月29日", "source": 9, "quote": "公共科目笔试时间为2026年11月29日"}]}
p, pr = g.verify(no_src, SRC)
check('资料编号不存在：剔除', not p and '不存在' in pr[0])

paraphrased = {"facts": [{"text": "笔试在2026年11月29日", "source": 1, "quote": "公共科目的笔试时间为2026年11月29日"}]}
p, _ = g.verify(paraphrased, SRC)
check('片段只多了个别字（模型常见）：容忍并通过', len(p) == 1)

cn_num = {"facts": [{"text": "报名截至十月二十四日", "source": 1, "quote": "网上报名时间为2026年10月14日8:00至10月24日18:00"}]}
p, _ = g.verify(cn_num, SRC)
check('陈述用中文数字、原文用阿拉伯数字：也能核对', len(p) == 1)

# ── 开场白和「没找到」不许夹带数字 ──
check('开场白里带数字的句子被删', g.clean_note("下面是整理。今年报名在10月。以官方为准。") == "下面是整理。以官方为准。")

# ── 最终输出 ──
r = g.finalize(data, passed, SRC, 0)
check('只保留被引用的来源，并重新编号', len(r['sources']) == 1 and r['facts'][0]['source'] == 1)
check('结尾提醒以官方公告为准', '以官方最新公告为准' in r['note'])
check('历史版本含来源和发布日期', '国家公务员局，发布于 2026-10-13' in r['markdown'])

r = g.finalize({"lead": "x", "facts": [], "missing": "资料里没有2027年的信息。"}, [], SRC, 0)
check('一条都没通过：给固定说明', r['facts'] == [] and r['markdown'].startswith('这次没有在搜到的网页里找到'))
check('固定说明里不出现模型写的数字', '2027' not in r['markdown'])

r = g.finalize(data, passed[:1], SRC, 1)
check('有剔除时如实说明', '没能在原文中核实' in r['note'])

check('JSON 外面包了代码块也能解析', g.parse('```json\n{"answerable": true, "facts": []}\n```') == {"answerable": True, "facts": []})
check('不是 JSON：返回 None', g.parse('好的，我来回答') is None)

msgs = g.build_messages("2027国考什么时候报名", SRC, "2026-10-15")
check('给模型的指令开头就写了今天的日期', msgs[0]['content'].startswith('今天是 2026-10-15'))
check('资料带发布日期', '发布日期：2026-10-13' in msgs[1]['content'])

# ── 长网页：日期在很后面，也要让模型看到 ──
long_page = ("网站导航 首页 新闻 体育 娱乐。" * 300 +
             "据悉，2027年度国考公共科目笔试时间为2026年11月29日。" +
             "相关推荐 热门文章 广告位招租。" * 300)
picked = g.pick_passages(long_page, "2027年国考笔试哪天")
check('长网页：日期在三千字之后也能被挑出来给模型', '笔试时间为2026年11月29日' in picked and len(picked) <= g.SOURCE_CHARS_FOR_MODEL)
check('短网页：原样给模型', g.pick_passages("很短的正文。", "问题") == "很短的正文。")
long_src = [{"title": "t", "site": "s", "date": "", "content": long_page}]
msgs = g.build_messages("2027年国考笔试哪天", long_src, "2026-10-15")
check('长网页：给模型的资料里含有笔试日期', '2026年11月29日' in msgs[1]['content'])
gap = {"facts": [{"text": "笔试在2026年11月29日", "source": 1, "quote": "笔试时间为2026年11月29日"}]}
p, _ = g.verify(gap, long_src)
check('长网页：从挑出的段落里摘的片段，在完整原文里能核对上', len(p) == 1)

# ── 剔除原因里带上片段开头，方便排查 ──
p, pr = g.verify(fabricated, SRC)
check('剔除原因里带上了模型摘的片段', '公共科目笔试时间为2027' in pr[0], pr[0])

# ── 接进对话：完整流程 ──
os.environ.setdefault('OPENAI_API_KEY', 'sk-test')
os.environ['TAVILY_API_KEY'] = 'tvly-test'; os.environ['ALLOW_OVERSEAS_SEARCH'] = 'true'
os.environ['SEARCH_PROVIDER'] = 'tavily'; os.environ.pop('BOCHA_API_KEY', None)
import db
db.DB_PATH = Path(tempfile.mkdtemp()) / 't.db'
import simple_server as srv
import web_search
from graph import agent
import auth
db.init_db(); agent._build_tools()
uid = str(uuid.uuid4())
with db._conn() as c:
    c.execute("INSERT INTO users(id,email,password_hash,nickname,invite_code,created_at) VALUES (?,?,?,?,?,?)",
              (uid, 'a@x.com', 'x', 'n', 'c', 'now'))
db.ensure_initial_grant(uid)
h = {"Authorization": "Bearer " + auth.issue_token(uid)}
cl = srv.app.test_client()
def sse(r): return [json.loads(l[6:]) for l in r.get_data(as_text=True).split('\n\n') if l.startswith('data: ')]
check('系统提示词最开头是今天的日期', agent._system_with_date().startswith('今天是 '))

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

web_search.search = lambda q, count=5: {"ok": True, "error": "", "results": [dict(s, snippet=s['content'][:60]) for s in SRC]}

def make_client(json_replies):
    replies = list(json_replies)
    seen = {'json_calls': 0}
    def create(**kw):
        if kw.get('stream'):
            return iter([_Ch(_D(c='我先凭记忆说一句：2027年国考还没公布。')),
                         _Ch(_D(t=[_TC(0, 'c1', _Fn('web_search', '{"query":"2027年国考 报名时间"}'))]))])
        seen['json_calls'] += 1
        return _Resp(replies.pop(0) if replies else '{}')
    return types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create))), seen

# 1）第一次就对
client, seen = make_client([json.dumps(data, ensure_ascii=False)])
agent._executor.client = client
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '2027年国考什么时候报名'}))
facts_ev = [e for e in evs if e['type'] == 'facts']
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('流程：给出核对过的要点', facts_ev and len(facts_ev[0]['facts']) == 2)
check('流程：搜索前凭记忆的话没展示', '还没公布' not in text and all('还没公布' not in json.dumps(e, ensure_ascii=False) for e in evs))
check('流程：有核对步骤且写明核实条数', any(e['type'] == 'step' and e['id'] == 'verify' and e.get('detail') == '核实 2 条' for e in evs))
done = evs[-1]
check('流程：来源只含被引用的那一个', [s['site'] for s in done['sources']] == ['国家公务员局'])
hist = cl.get(f"/api/chat/{done['thread_id']}", headers=h).get_json()['messages']
check('流程：刷新后要点、来源、说明都在', hist[-1].get('facts') and hist[-1].get('sources') and hist[-1].get('note'))
check('流程：刷新后正文只是开场白', hist[-1]['content'] == '根据国家公务员局的公告，整理如下。')
raw = db.load_messages(done['thread_id'])
tcs = {tc['id'] for m in raw if m.get('tool_calls') for tc in m['tool_calls']}
check('流程：历史合法（每个工具调用都有回复）', {m['tool_call_id'] for m in raw if m['role'] == 'tool'} == tcs)
check('流程：历史里留了带来源的文本版（之后追问用）', '发布于 2026-10-13' in (raw[-1].get('content') or ''))

# 2）第一次年份顺延被拦，第二次改对
client, seen = make_client([json.dumps(bad_year, ensure_ascii=False), json.dumps(data, ensure_ascii=False)])
agent._executor.client = client
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '2027年国考什么时候报名'}))
f = [e for e in evs if e['type'] == 'facts']
check('重试：第一次错了会让模型改一次', seen['json_calls'] == 2)
check('重试：改对后正常给出要点', f and len(f[0]['facts']) == 2)
check('重试：错误的 2027 没出现在回答里', all('2027年10月14日' not in json.dumps(e, ensure_ascii=False) for e in evs))

# 3）两次都编，给固定说明
client, seen = make_client([json.dumps(fabricated, ensure_ascii=False)] * 2)
agent._executor.client = client
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '2027年国考笔试哪天'}))
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('兜底：重试仍不过，给固定说明', text.startswith('这次没有在搜到的网页里找到'), text)
check('兜底：最多重试一次', seen['json_calls'] == 2)
check('兜底：编造的日期没出现', '11月28日' not in text and not [e for e in evs if e['type'] == 'facts'])
check('兜底：不列来源', evs[-1]['sources'] == [])

# 4）搜索服务挂了
web_search.search = lambda q, count=5: {"ok": False, "error": "搜索服务返回 401", "results": []}
client, seen = make_client([])
agent._executor.client = client
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '2027年国考笔试哪天'}))
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('搜索挂了：明说没法核实，不调模型编', text.startswith('联网搜索暂时不可用') and seen['json_calls'] == 0, text)

# 5）不需要搜索的问题：不受影响
def plain(**kw):
    return iter([_Ch(_D(c='国考一般分')), _Ch(_D(c='行政和公安等类别。'))])
agent._executor.client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=plain)))
evs = sse(cl.post('/api/chat/stream', headers=h, json={'message': '国考分几类'}))
text = ''.join(e.get('text', '') for e in evs if e['type'] == 'token')
check('常识问题：照常回答，不走核对', text == '国考一般分行政和公安等类别。' and not any(e.get('id') == 'verify' for e in evs))

print('\nALL PASS' if ok else '\nSOME FAILED')
sys.exit(0 if ok else 1)
