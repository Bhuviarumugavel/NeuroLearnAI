import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from app.config import DEFAULT_EMAIL, DEFAULT_PASSWORD

def send_email_notification(to_email: str, subject: str, body_text: str):
    """Send an email notification to the student using DEFAULT_EMAIL credentials."""
    sender_email = DEFAULT_EMAIL or "bhuvaneshwari23ad006@gmail.com"
    sender_password = DEFAULT_PASSWORD or "23AD006@AIDS"

    print(f"[SMTP] Attempting email send to {to_email}...")
    try:
        msg = MIMEMultipart()
        msg['From'] = f"NeurolearnAI Study Assistant <{sender_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body_text, 'html' if "<html>" in body_text else 'plain'))

        # Gmail SMTP Configuration
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=10.0)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        print(f"[SMTP] Study alert email successfully delivered to {to_email}.")
        return True
    except Exception as e:
        print(f"[SMTP-WARN] Failed email dispatch to {to_email} (Using terminal fallback log): {e}")
        return False
