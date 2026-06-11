import pickle
import sys

def check_model(filename):
    try:
        with open(filename, 'rb') as f:
            model = pickle.load(f)
            print(f"{filename}: {getattr(model, 'n_features_in_', 'Unknown features')}")
            if hasattr(model, 'feature_names_in_'):
                print(f"Features: {model.feature_names_in_}")
    except Exception as e:
        print(f"Error reading {filename}: {e}")

check_model('d:/ML Project/random_forest.pkl')
check_model('d:/ML Project/logistic.pkl')
