"""Run: python -m pip install 'fakeredis[lua]'; python tests/redis_budget_test.py.
Executes the production Lua with an embedded Lua engine against shared Redis semantics.
No network, provider, credentials, or local Redis daemon required.
"""
import concurrent.futures
import re
import unittest
from pathlib import Path
import fakeredis

SCRIPT = re.search(r"const RESERVE = `(.*?)`;", (Path(__file__).resolve().parents[1] / "src/lib/paid-ai.ts").read_text(encoding="utf-8"), re.S).group(1)

class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.keys = ['day:synthetic','minute:synthetic','active']
        self.counter = 0
    def reserve(self, attempts=1, cap=100, now=1000000):
        self.counter += 1
        return self.redis.eval(SCRIPT, 3, *self.keys, now, f'lease-{self.counter}', attempts, cap)
    def test_daily_worst_case_fallback_attempts_are_charged_before_work(self):
        self.assertEqual(self.reserve(3, 3), 1)
        self.redis.delete('active')
        self.assertEqual(self.reserve(1, 3), 0)
        self.assertEqual(int(self.redis.get(self.keys[0])), 3)
    def test_minute_limit_survives_lease_release(self):
        for _ in range(10):
            self.assertEqual(self.reserve(), 1)
            self.redis.delete('active')
        self.assertEqual(self.reserve(), 0)
        self.assertEqual(int(self.redis.get(self.keys[0])), 10)
    def test_crashed_worker_lease_expires(self):
        self.assertEqual(self.reserve(), 1)
        self.assertEqual(self.reserve(), 1)
        self.assertEqual(self.reserve(), 0)
        self.assertEqual(self.reserve(now=1120001), 1)
    def test_concurrent_instances_share_the_two_request_limit(self):
        server=fakeredis.FakeServer()
        def attempt(number):
            client=fakeredis.FakeRedis(server=server)
            return client.eval(SCRIPT,3,*self.keys,1000000,str(number),1,100)
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            self.assertEqual(sum(pool.map(attempt,range(20))),2)
        client=fakeredis.FakeRedis(server=server)
        self.assertEqual(int(client.get(self.keys[0])),2)

if __name__ == '__main__': unittest.main()
