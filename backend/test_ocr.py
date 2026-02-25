import easyocr

reader = easyocr.Reader(['en'])
result = reader.readtext('captcha.png')

print(result)
