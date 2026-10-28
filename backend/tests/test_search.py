"""联网搜索模块的离线测试（不出网）。运行：cd backend && python3 tests/test_search.py"""
import json, os, sys, urllib.error
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
for k in ('BOCHA_API_KEY', 'TAVILY_API_KEY', 'SEARCH_PROVIDER', 'ALLOW_OVERSEAS_SEARCH'):
    os.environ.pop(k, None)
import web_search as w

ok = True
def check(n, c, e=''):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n, e)

check('什么都没配：未启用', not w.configured())

os.environ['TAVILY_API_KEY'] = 'tvly-test'
check('只配了 Tavily 但没放行境外：不启用', not w.configured())
check('未放行时 search 直接返回「未启用」，不发请求', w.search('x')['error'] == '联网搜索未启用')

os.environ['ALLOW_OVERSEAS_SEARCH'] = 'true'
check('放行境外后启用 Tavily', w.configured() and w._provider() == 'tavily')

os.environ['BOCHA_API_KEY'] = 'bk-test'
check('两个都配了且没指定：优先国内的博查', w._provider() == 'bocha')
os.environ['SEARCH_PROVIDER'] = 'tavily'
check('显式指定 tavily', w._provider() == 'tavily')
os.environ['SEARCH_PROVIDER'] = 'bocha'
check('显式指定 bocha', w._provider() == 'bocha')
os.environ['SEARCH_PROVIDER'] = 'nonexistent'
check('指定了不存在的源：不启用', not w.configured())
os.environ.pop('SEARCH_PROVIDER')
os.environ.pop('ALLOW_OVERSEAS_SEARCH')
os.environ.pop('BOCHA_API_KEY')
os.environ['SEARCH_PROVIDER'] = 'tavily'
check('指定 tavily 但没放行境外：不启用（防止误带上线）', not w.configured())

os.environ['ALLOW_OVERSEAS_SEARCH'] = 'true'
sent = {}
class FakeResp:
    def __init__(s, p): s.p = p
    def read(s): return json.dumps(s.p).encode()
    def __enter__(s): return s
    def __exit__(s, *a): pass
def fake(req, timeout=0):
    sent['url'] = req.full_url; sent['auth'] = req.headers.get('Authorization')
    sent['body'] = json.loads(req.data.decode()); sent['timeout'] = timeout
    return FakeResp({"query": "q", "results": [
        {"title": "2026年国考公告", "url": "https://www.scs.gov.cn/a", "content": "笔试 11 月底", "score": 0.9},
        {"title": "坏链接", "url": "javascript:alert(1)", "content": "x"},
        {"title": "备考", "url": "http://example.cn/b", "content": "三阶段", "published_date": "2025-10-14"}]})
w.urllib.request.urlopen = fake
r = w.search('2026年国家公务员考试 〔手机号1〕 笔试时间')
check('Tavily：请求地址与鉴权头', sent['url'] == 'https://api.tavily.com/search' and sent['auth'] == 'Bearer tvly-test')
check('Tavily：脱敏占位符不外发', '〔' not in sent['body']['query'], sent['body']['query'])
check('Tavily：key 不在请求体里', 'tvly-test' not in json.dumps(sent['body']))
check('Tavily：解析并丢弃危险链接', [x['url'] for x in r['results']] == ['https://www.scs.gov.cn/a', 'http://example.cn/b'])
check('Tavily：摘要与日期', r['results'][0]['snippet'] == '笔试 11 月底' and r['results'][1]['date'] == '2025-10-14')
check('Tavily：设置了超时', sent['timeout'] == w.TIMEOUT)

def err401(req, timeout=0): raise urllib.error.HTTPError(req.full_url, 401, 'x', {}, None)
w.urllib.request.urlopen = err401
check('401 如实报告，不抛异常', w.search('x') == {'ok': False, 'results': [], 'error': '搜索服务返回 401'})

print('\nALL PASS' if ok else '\nSOME FAILED')
sys.exit(0 if ok else 1)
