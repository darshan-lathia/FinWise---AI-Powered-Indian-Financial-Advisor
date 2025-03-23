import os
import json
from datetime import datetime
from flask import request, Flask, g
from functools import wraps

def setup_interaction_logging(app):
    # Create a decorator for logging interactions
    def log_interaction(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            client_ip = request.remote_addr
            user_agent = request.headers.get('User-Agent', 'Unknown')
            data = request.json
            
            # Log the request
            log_entry = {
                "timestamp": timestamp,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "endpoint": request.path,
                "query": data.get('chat', '') if data else '',
                "history_length": len(data.get('history', [])) if data else 0,
            }
            
            log_path = os.environ.get('FINWISE_INTERACTION_LOG_DIR', '/tmp')
            log_file = f"{log_path}/{timestamp}_{client_ip.replace('.', '_')}.json"
            
            with open(log_file, 'w') as f:
                json.dump(log_entry, f, indent=2)
            
            # Store for later use
            g.log_entry = log_entry
            g.log_file = log_file
            
            # Call the original handler
            result = f(*args, **kwargs)
            
            # Log the response if available
            if hasattr(g, 'log_entry'):
                if isinstance(result, dict):
                    g.log_entry["response"] = result.get("text", "")
                else:
                    g.log_entry["response"] = "Stream response"
                
                with open(g.log_file, 'w') as f:
                    json.dump(g.log_entry, f, indent=2)
            
            return result
        return decorated_function
    
    # Add the decorator to all relevant routes
    app.before_request(lambda: setattr(g, 'start_time', datetime.now()))
    
    # Return the decorator for use in app.py
    return log_interaction
