
import os

file_path = r"c:\Users\NiroshMadushan\Documents\VMS NEW ONE\vmssystem (7) (3)\components\admin\booking-management.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'const loadBookingParticipants = async' in line:
        print(f"Line {i+1}: {repr(line)}")
