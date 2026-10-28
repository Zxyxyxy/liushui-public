"""对话生成任务：把一轮生成和 HTTP 连接解耦。

以前生成是跟着连接走的：用户在生成途中点到别的页面，浏览器断开连接，服务端随之停止，这一轮
既不落库也看不到，回到对话页时问题和回答都没了。

现在每一轮在后台线程里跑完、照样落库；产出的事件存在内存缓冲区里，谁都可以从头读：
  - 发起请求的那次连接边产出边转发
  - 用户离开后再回到对话页，用 job_id 或 thread_id 重新接上，先补发已产出的部分，再继续跟
只有用户明确点「停止」才会取消（取消后照旧退积分、不落库）。

任务只存在当前进程的内存里：服务重启会丢掉正在跑的任务，这和以前一致。跑完的任务保留一会儿供重新接上，
之后清理掉，历史以数据库为准。
"""

import threading
import time
import uuid
from typing import Callable, Dict, Iterator, List, Optional

KEEP_FINISHED = 120     # 跑完的任务在内存里留多少秒，供回到对话页的人接上
MAX_RUNTIME = 600       # 单轮最多跑多久；超时视为卡死，取消掉


class Job:
    def __init__(self, user_id: str, thread_id: Optional[str], display: str = "", kind: str = "message",
                 attachments: Optional[list] = None):
        self.id = uuid.uuid4().hex
        self.user_id = user_id
        self.display = display          # 用户这一轮问的话（给人看的版本）：落库前回到对话页要靠它显示
        self.kind = kind                # message / run / digest / regenerate
        self.attachments = attachments or []
        self.thread_id = thread_id      # 新对话在落库后才有，由 produce 产出的 done 事件补上
        self.events: List[str] = []     # 原样的 SSE 文本块
        self.done = False
        self.cancelled = False
        self.started = time.time()
        self.finished = 0.0
        self.cond = threading.Condition()

    def push(self, chunk: str) -> None:
        with self.cond:
            self.events.append(chunk)
            self.cond.notify_all()

    def finish(self) -> None:
        with self.cond:
            self.done = True
            self.finished = time.time()
            self.cond.notify_all()

    def follow(self, start: int = 0) -> Iterator[str]:
        """从第 start 个事件开始读，一直跟到结束。读的人断开不影响任务本身。"""
        i = start
        while True:
            with self.cond:
                while i >= len(self.events) and not self.done:
                    self.cond.wait(timeout=15)
                    if i >= len(self.events) and not self.done:
                        break   # 15 秒没新事件：发一个注释行保活，防止代理断开空闲连接
                chunk = self.events[i] if i < len(self.events) else None
                finished = self.done and i >= len(self.events)
            if finished:
                return
            if chunk is None:
                yield ": keepalive\n\n"
                continue
            i += 1
            yield chunk


_jobs: Dict[str, Job] = {}
_lock = threading.Lock()


def _gc() -> None:
    now = time.time()
    with _lock:
        for jid in [k for k, j in _jobs.items() if j.done and now - j.finished > KEEP_FINISHED]:
            del _jobs[jid]


def start(user_id: str, thread_id: Optional[str], produce: Callable[[], Iterator[str]],
          display: str = "", kind: str = "message", attachments: Optional[list] = None) -> Job:
    """在后台线程里把 produce() 跑完。第一个事件告诉前端任务编号，用于离开后重新接上。"""
    _gc()
    job = Job(user_id, thread_id, display, kind, attachments)
    with _lock:
        _jobs[job.id] = job
    job.push(f'data: {{"type":"job","job_id":"{job.id}"}}\n\n')

    def run():
        gen = produce()
        try:
            for chunk in gen:
                if job.cancelled or time.time() - job.started > MAX_RUNTIME:
                    gen.close()   # 触发 produce 里的 GeneratorExit：退积分、不落库
                    job.push('data: {"type":"cancelled"}\n\n')
                    break
                if job.thread_id is None and '"type": "done"' in chunk and '"thread_id"' in chunk:
                    import json
                    try:
                        job.thread_id = json.loads(chunk[len("data: "):]).get("thread_id")
                    except Exception:
                        pass
                job.push(chunk)
        except Exception as e:
            job.push(f'data: {{"type":"error","message":"生成中断：{str(e)[:100]}"}}\n\n')
        finally:
            job.finish()

    threading.Thread(target=run, daemon=True, name=f"turn-{job.id[:8]}").start()
    return job


def get(job_id: str, user_id: str) -> Optional[Job]:
    with _lock:
        j = _jobs.get(job_id)
    return j if j and j.user_id == user_id else None


def running_for_thread(thread_id: str, user_id: str) -> Optional[Job]:
    """这个对话有没有正在跑（或刚跑完、还没被看到）的一轮。"""
    with _lock:
        hits = [j for j in _jobs.values() if j.user_id == user_id and j.thread_id == thread_id]
    hits.sort(key=lambda j: j.started, reverse=True)
    return hits[0] if hits else None


def running_new(user_id: str) -> Optional[Job]:
    """用户最近一个还没落库、没有对话编号的新对话任务（在「新对话」里发问后立刻离开的情况）。"""
    with _lock:
        hits = [j for j in _jobs.values() if j.user_id == user_id and j.thread_id is None and not j.done]
    hits.sort(key=lambda j: j.started, reverse=True)
    return hits[0] if hits else None


def cancel(job_id: str, user_id: str) -> bool:
    j = get(job_id, user_id)
    if not j or j.done:
        return False
    j.cancelled = True
    return True
