import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import import_erp as imp


def batch(day='2026-11-20', signature='a'):
    stock = dict(id='X', name='Produto', unit='KG', date=day, stock=15,
                 warehouse=10, warehouses=[dict(code='1', name='MP', qty=10),
                                            dict(code='2', name='Produção', qty=5)])
    params = dict(id='X', name='Produto', unit='KG', date=day, pages=[1],
                  safety=0, monthly=None, lead=1, buffer=1, min=0, multiple=1)
    request = dict(id='X', name='Produto', unit='KG', date=day, row=2,
                   source='csv', company='1', order='123', message='', qty=1)
    return dict(date=day, stocks=[stock], params=[params], requests=[request],
                movements=[], files=[dict(name='arquivo', sha256=signature)])


class InMemoryImportTests(unittest.TestCase):
    def test_history_duplicates_and_conflicts(self):
        first, audit = imp.apply_batch(None, batch())
        self.assertIsNotNone(audit)
        first['parameterEdits'] = [dict(id='X', date='2026-11-20', values={'monthly': 10},
                                       savedAt='2026-11-20T12:00:00Z', knownDates=['2026-11-20'])]
        before = copy.deepcopy(first)
        duplicate, audit = imp.apply_batch(copy.deepcopy(first), batch())
        self.assertIsNone(audit)
        self.assertEqual(duplicate, before)
        with self.assertRaises(ValueError):
            imp.apply_batch(copy.deepcopy(first), batch(signature='changed'))
        after, audit = imp.apply_batch(copy.deepcopy(first), batch('2026-11-21', 'b'))
        self.assertEqual(after['parameterEdits'], before['parameterEdits'])
        for name in ('daily', 'weekly', 'requests', 'movements', 'paramSnapshots', 'reportProfiles'):
            self.assertEqual([r for r in after[name] if r['date'] != '2026-11-21'], before[name])
        self.assertEqual(after['weekly'][-1]['warehouse'], 10)
        self.assertEqual(after['paramSnapshots'][-1]['safety'], 0)
        self.assertIsNone(after['paramSnapshots'][-1]['monthly'])


if __name__ == '__main__':
    unittest.main()
