import pickle
import pandas as pd
import numpy as np
from pathlib import Path
import joblib
# Path relative to the execution root (usually BACKEND/)




class MLService:

    def calculate_ratings(self, students_data: list[dict]) -> dict[int, float]:

        model_path = Path(__file__).resolve().parent.parent / "ml" / "Model.pkl"
        print(f"Loading ML Model from {model_path}", flush=True)

        
        model = None
        try:
            if model_path.exists():
                model = joblib.load(model_path)
                print(f"ML Model loaded from {model_path}", flush=True)
            else:
                print(f"Warning: ML Model not found at {model_path}. Predictions will return 0.0", flush=True)
        except Exception as e:
            print(f"Error loading ML Model: {e}", flush=True)


        """
        Calculates ratings for a list of student performance dictionaries.
        Returns a dictionary mapping student_id -> rating.
        """
        if model is None or not students_data:
            return {s['id_estudiante']: 0.0 for s in students_data}

        results = {}
        
        # Prepare DataFrame
        # The model expects specific columns. We assume the dict keys match the model features.
        # Boolean roles need to be converted to int if the model expects that.
        
        feature_columns = [
            'role_Attacker', 'role_Defender', 'role_Keeper', 'role_Midfielder',
            'diving_save', 'goals_conceded', 'minutes_played', 'punches',
            'saves', 'saves_inside_box', 'throws', 'assists', 'chances_created',
            'goals', 'pass_success', 'total_shots', 'blocked_shots',
            'shot_accuracy', 'shot_off_target', 'shot_on_target', 'crosses',
            'key_passes', 'touches', 'aerials_won', 'dribbles_succeeded',
            'duels_won', 'interceptions', 'recoveries', 'tackles_attempted',
            'tackles_succeeded', 'was_fouled'
        ]

        # Filter and order columns
        df_rows = []
        ids = []
        
        for student in students_data:
            row = {}
            for col in feature_columns:
                # Map snake_case to model expected columns if necessary. 
                # Assuming model columns match the requested list exactly (snake_case or specialized).
                # The user list had some CamelCase roles and snake_case others?
                # User list: role_Attacker, role_Defender... diving_save...
                
                # Check mapping from our schema (snake_case fully?)
                # Our schema has role_attacker (lowercase). User asked for role_Attacker? 
                # "Ultimo recordatorio las columnas son estas: role_Attacker..."
                
                # We need to map our schema keys to these specific keys.
                val = student.get(col, 0)
                if col.startswith('role_'):
                     # If the model keys are 'role_Attacker', etc. we need to match them.
                     # Our input uses the same keys as the model expects now (mapped in service).
                     lower_key = col.lower()
                     
                     # First try direct exact match
                     val = student.get(col)
                     if val is None:
                         # Then try lowercase
                         val = student.get(lower_key, 0)
                     
                row[col] = val
            
            # Feature vals are already ints from service mapping
            
            df_rows.append(row)
            ids.append(student.get('id_estudiante'))

        if not df_rows:
            return {}

        try:
            df = pd.DataFrame(df_rows)
            # Ensure column order matches user list exactly if model is sensitive to feature order
            df = df[feature_columns] 
            
            predictions = model.predict(df)
            
            for i, student_id in enumerate(ids):
                results[student_id] = float(predictions[i])
                
        except Exception as e:
            print(f"Prediction error: {e}")
            # Fallback
            for student_id in ids:
                 results[student_id] = 0.0

        return results

ml_service = MLService()
