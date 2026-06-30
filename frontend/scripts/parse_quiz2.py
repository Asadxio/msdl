import re
import json

file_path = r"C:\Users\xioas\OneDrive\Desktop\quiz 2 seed.txt"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('**', '')
content = content.replace('---', '')

# Also remove 'Question X' headers so they don't break the regex
content = re.sub(r'## Question \d+', '', content)
content = re.sub(r'Question \d+', '', content)
content = re.sub(r'# Category:.*', '', content)
content = re.sub(r'Category:.*\(.*?\)', '', content)

pattern = re.compile(
    r"Question\n(.*?)\n+"
    r"Option 1\n(.*?)\n+"
    r"Option 2\n(.*?)\n+"
    r"Option 3\n(.*?)\n+"
    r"Option 4\n(.*?)\n+"
    r"Correct Answer\n(.*?)\n+"
    r"Category\n(.*?)(?=\n+Question\n|\Z)", 
    re.DOTALL
)

matches = pattern.findall(content)

questions = []
for m in matches:
    questions.append({
        "question": m[0].strip(),
        "option1": m[1].strip(),
        "option2": m[2].strip(),
        "option3": m[3].strip(),
        "option4": m[4].strip(),
        "correctAnswer": m[5].strip(),
        "category": m[6].strip()
    })

with open(r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\scripts\quiz2_parsed.json", "w", encoding="utf-8") as f:
    json.dump(questions, f, indent=4)

print(f"Parsed {len(questions)} questions using regex.")
