import unittest
import json
from app import app

class TestApp(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_ping(self):
        response = self.client.get('/ping')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'ok')

    def test_market_data(self):
        response = self.client.get('/market-data')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        # Check for expected keys in the response
        self.assertIn('forex', data)
        self.assertIn('indices', data)
        self.assertIn('timestamp', data)
        self.assertIn('top_gainers', data)
        self.assertIn('top_losers', data)

if __name__ == '__main__':
    unittest.main() 