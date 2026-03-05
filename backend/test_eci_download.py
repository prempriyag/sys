import requests

url = 'http://127.0.0.1:8000/api/upload/eci-download'
params = {
    'state':'Tamil Nadu',
    'revyear':'2026',
    'district':'Dindigul',
    'ac_name':'test',
    'language':'English',
    'manual_captcha':'true'
}
print('posting', params)
resp = requests.post(url, data=params)
print('status', resp.status_code)
print('headers', resp.headers)
print('body', resp.text)
