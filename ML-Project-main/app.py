from flask import Flask, render_template, request, jsonify
import pickle
import pandas as pd
import numpy as np
import os
import sqlite3
import datetime

app = Flask(__name__)

# ---------------------------------------------------------
# DATABASE INITIALIZATION
# ---------------------------------------------------------
DB_FILE = 'records.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            age REAL,
            sex TEXT,
            trestbps REAL,
            chol REAL,
            risk_score REAL,
            status TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# ---------------------------------------------------------
# LOAD MODELS AND SCALER
# ---------------------------------------------------------
def load_file(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    if not os.path.exists(filepath):
        print(f"Warning: File '{filename}' not found.")
        return None
    try:
        with open(filepath, 'rb') as f:
            model = pickle.load(f)
            print(f"Successfully loaded {filename}")
            return model
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return None

rf_model = load_file('random_forest.pkl')
lr_model = load_file('logistic.pkl')
mlp_model = load_file('mlp.pkl')
scaler = load_file('scaler.pkl')

cp_map = {"Typical Angina": 0, "Atypical Angina": 1, "Non-Anginal": 2, "Asymptomatic": 3}
restecg_map = {"Normal": 0, "ST-T Wave": 1, "Hypertrophy": 2}
slope_map = {"Upsloping": 0, "Flat": 1, "Downsloping": 2}
thal_map = {"Normal": 1, "Fixed": 2, "Reversible": 3}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/records', methods=['GET'])
def get_records():
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM predictions ORDER BY timestamp DESC LIMIT 50')
        rows = c.fetchall()
        conn.close()
        
        records = []
        for row in rows:
            records.append(dict(row))
        return jsonify(records)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    
    try:
        age = float(data.get('age', 35))
        sex = data.get('sex', 'Male')
        cp = data.get('cp', 'Typical Angina')
        trestbps = float(data.get('trestbps', 120))
        chol = float(data.get('chol', 200))
        fbs = data.get('fbs', 'No')
        restecg = data.get('restecg', 'Normal')
        thalach = float(data.get('thalach', 160))
        exang = data.get('exang', 'No')
        oldpeak = float(data.get('oldpeak', 0.0))
        slope = data.get('slope', 'Upsloping')
        ca = float(data.get('ca', 0))
        thal = data.get('thal', 'Normal')
        
        sex_v = 1 if sex == "Male" else 0
        fbs_v = 1 if fbs == "Yes" else 0
        exang_v = 1 if exang == "Yes" else 0
        
        raw_features = [
            age, sex_v, cp_map.get(cp, 0), trestbps, chol, fbs_v, 
            restecg_map.get(restecg, 0), thalach, exang_v, oldpeak, 
            slope_map.get(slope, 0), ca, thal_map.get(thal, 1)
        ]
        
        if scaler is None:
            return jsonify({'error': 'Scaler not found'})
            
        features_scaled = scaler.transform([raw_features])
        cols = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal']
        input_df = pd.DataFrame(features_scaled, columns=cols)
        
        def get_pred(model):
            if model is None: return 0.0, 0
            try:
                prob = model.predict_proba(input_df)[0]
                return float(prob[1]), int(model.predict(input_df)[0])
            except:
                pred = int(model.predict(input_df)[0])
                return float(pred), pred
                
        rf_prob, rf_pred = get_pred(rf_model)
        lr_prob, lr_pred = get_pred(lr_model)
        mlp_prob, mlp_pred = get_pred(mlp_model)
        
        ensemble_prob = (rf_prob + lr_prob + mlp_prob) / 3.0
        
        # Save to database if requested
        save_record = data.get('save_record', True)
        if save_record:
            risk_score = round(ensemble_prob * 100, 2)
            status = 'High Risk' if risk_score >= 50 else 'Safe'
            
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('''
                INSERT INTO predictions (age, sex, trestbps, chol, risk_score, status)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (age, sex, trestbps, chol, risk_score, status))
            conn.commit()
            conn.close()
        
        results = {
            'random_forest': {'probability': rf_prob, 'prediction': rf_pred},
            'logistic': {'probability': lr_prob, 'prediction': lr_pred},
            'mlp': {'probability': mlp_prob, 'prediction': mlp_pred},
            'ensemble_prob': ensemble_prob
        }
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)