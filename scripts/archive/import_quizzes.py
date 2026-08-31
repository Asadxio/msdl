import firebase_admin
from firebase_admin import credentials, firestore
import re
import time
import sys

SERVICE_ACCOUNT_PATH = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\serviceAccountKey.json"
INPUT_PATH = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\all_user_input.txt"

def parse_quizzes(text):
    quizzes = []
    
    # Split by "Question 1", "Question 2", etc.
    # Actually, split by "\nQuestion\n"
    # But wait, in the data, it's "Question 1\n\nQuestion\nNajasat..."
    
    parts = re.split(r'\nQuestion\n', text)
    
    for i, part in enumerate(parts):
        if i == 0:
            continue
        
        try:
            q_match = re.search(r'^(.*?)\n+Option 1\n', part, re.DOTALL)
            o1_match = re.search(r'Option 1\n(.*?)\n+Option 2\n', part, re.DOTALL)
            o2_match = re.search(r'Option 2\n(.*?)\n+Option 3\n', part, re.DOTALL)
            o3_match = re.search(r'Option 3\n(.*?)\n+Option 4\n', part, re.DOTALL)
            o4_match = re.search(r'Option 4\n(.*?)\n+Correct Answer\n', part, re.DOTALL)
            ca_match = re.search(r'Correct Answer\n(.*?)\n+Category\n', part, re.DOTALL)
            
            if not (q_match and o1_match and o2_match and o3_match and o4_match and ca_match):
                continue
                
            question = q_match.group(1).strip()
            o1 = o1_match.group(1).strip()
            o2 = o2_match.group(1).strip()
            o3 = o3_match.group(1).strip()
            o4 = o4_match.group(1).strip()
            ca = ca_match.group(1).strip()
            
            cat_match = re.search(r'Category\n([^\n]+)', part)
            if not cat_match:
                continue
            cat = cat_match.group(1).strip()
            
            quiz = {
                "question": question,
                "option1": o1,
                "option2": o2,
                "option3": o3,
                "option4": o4,
                "correctAnswer": ca,
                "category": cat
            }
            quizzes.append(quiz)
        except Exception as e:
            continue
            
    return quizzes

def validate_quiz(quiz):
    required = ["question", "option1", "option2", "option3", "option4", "correctAnswer", "category"]
    for r in required:
        if r not in quiz or not isinstance(quiz[r], str) or quiz[r] == "":
            return False, f"Missing or empty field: {r}"
            
    ca = quiz["correctAnswer"]
    options = [quiz["option1"], quiz["option2"], quiz["option3"], quiz["option4"]]
    if ca not in options:
        return False, f"correctAnswer '{ca}' does not match any option"
        
    return True, ""

def main():
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("Authentication: SUCCESS")
    except Exception as e:
        print(f"Authentication: FAILED\n{e}")
        return
        
    try:
        db = firestore.client()
        print("Firestore: CONNECTED")
    except Exception as e:
        print(f"Firestore: FAILED\n{e}")
        return
    
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        text = f.read()
        
    parsed_quizzes = parse_quizzes(text)
    
    existing_questions = set()
    try:
        docs = db.collection('quizzes').stream()
        for doc in docs:
            data = doc.to_dict()
            if 'question' in data:
                existing_questions.add(data['question'])
    except Exception as e:
        print(f"Firestore: FAILED\n{e}")
        return
        
    start_time = time.time()
    
    inserted_count = 0
    skipped_count = 0
    validation_errors = 0
    failed_writes = 0
    
    category_counts = {}
    valid_new_quizzes = []
    
    for q in parsed_quizzes:
        is_valid, err = validate_quiz(q)
        if not is_valid:
            validation_errors += 1
            continue
            
        if q["question"] in existing_questions:
            skipped_count += 1
            continue
            
        valid_new_quizzes.append(q)
        existing_questions.add(q["question"])
        
    batch_count = 0
    batch_size = 400
    
    for i in range(0, len(valid_new_quizzes), batch_size):
        chunk = valid_new_quizzes[i:i+batch_size]
        batch = db.batch()
        
        for q in chunk:
            doc_ref = db.collection('quizzes').document()
            batch.set(doc_ref, q)
            
        try:
            batch.commit()
            batch_count += 1
            inserted_count += len(chunk)
            
            for q in chunk:
                cat = q['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
                
        except Exception as e:
            failed_writes += len(chunk)
            print(f"Batch {batch_count + 1} failed: {e}")
            break
            
    total_quizzes = len(existing_questions)
    exec_time = time.time() - start_time
    
    print("\nDocuments Processed:")
    print(f"Inserted: {inserted_count}")
    print(f"Skipped (Duplicates): {skipped_count}")
    print(f"Validation Errors: {validation_errors}")
    print(f"Failed Writes: {failed_writes}")
    print(f"Batch Count: {batch_count}")
    
    print("\nCategory Counts:")
    for cat, count in category_counts.items():
        print(f"{cat}: {count}")
        
    print(f"\nFinal Total Quiz Count: {total_quizzes}")
    print(f"Execution Time: {exec_time:.2f} seconds")
    
    if failed_writes > 0:
        print("\nImport Status: FAILED")
    elif inserted_count > 0:
        print("\nImport Status: SUCCESS")
    else:
        print("\nImport Status: SUCCESS")

if __name__ == "__main__":
    main()
