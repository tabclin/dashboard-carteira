import requests


SUPABASE_URL = "https://hlfiykpoousspkcdswer.supabase.co"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZml5a3Bvb3Vzc3BrY2Rzd2VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTIwODAsImV4cCI6MjA4ODIyODA4MH0.eY0jsDbj6O-1HZxafJ5Mu6tLpcMMGHht-OtlAsTgjMQ"


def login(email, senha):

    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"

    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "email": email,
        "password": senha
    }

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 200:

        data = response.json()

        return data["user"]

    return None
