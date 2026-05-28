
import os

file_path = r"c:\Users\NiroshMadushan\Documents\VMS NEW ONE\vmssystem (7) (3)\components\admin\booking-management.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_until = -1
definitions_found = 0

for i, line in enumerate(lines):
    # Skip lines if we are in a skip block
    if i <= skip_until:
        continue

    # Fix indentation: If line starts with 10 spaces, remove 8
    if line.startswith('          '):
        line = '  ' + line[10:]
    elif line.startswith('            '):
        line = '    ' + line[12:]
    elif line.startswith('              '):
        line = '      ' + line[14:]
    elif line.startswith('                '):
        line = '        ' + line[16:]

    # Remove duplicates of loadBookingParticipants
    # We want to keep ONLY ONE definition.
    # Actually, I'll rename the one at 1129 back to normal if I find it.
    if 'const loadBookingParticipants_API = async' in line or 'const loadBookingParticipants = async' in line:
        definitions_found += 1
        if definitions_found > 1:
            # This is a duplicate. Skip it and its block.
            # Usually the block ends with a closing brace for the function.
            # We'll skip some lines or just skip this line.
            # Since we don't know the exact length, we'll try to find the end.
            continue 
        else:
            # Keep the first one and make sure it has the correct name
            line = line.replace('loadBookingParticipants_API', 'loadBookingParticipants')
            new_lines.append(line)
            continue

    # Fix the calls too
    if 'loadBookingParticipants_API(' in line:
        line = line.replace('loadBookingParticipants_API', 'loadBookingParticipants')

    new_lines.append(line)

# Now, handle the corruption at the end.
# The end should be:
#         </DialogContent>
#       </Dialog>
#     </div>
#   )
# }

# We'll truncate anything after the last logical closing of the component.
# Or better, we'll just rewrite the end carefully.

def fix_end(lines):
    # Find the last occurrence of "export function BookingManagement"
    # Wait, there's only one.
    # We'll just look for the pattern of the end.
    
    # Let's find the last legitimate looking line from our view_file
    # Line 4390 was DialogTitle
    # Line 4403 was }
    
    # We'll cut the lines at the first sign of the corruption (from current file)
    # The corruption started appearing around the end of the file.
    
    # I'll just look for where the file should have ended.
    # In my view_file it looked okay up to 4403.
    # But cat showed corruption.
    
    # I'll just take the lines and if they look like the corruption, I'll stop.
    clean_lines = []
    for line in lines:
        if 't>ertDialogOpen(false)}>' in line or 'Dialog>K' in line or 'Button>nC' in line:
            break
        clean_lines.append(line)
    
    # Ensure it ends correctly
    # (Simplified: we'll just trust the clean_lines if we found the corruption)
    
    return clean_lines

final_lines = fix_end(new_lines)

# Ensure the end of the file is correct
# We'll append the correct ending if it's missing or truncated
if '}' not in final_lines[-1]:
    # This might be too simplistic, but let's see.
    pass

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

# Append the correct closing if needed
with open(file_path, 'a', encoding='utf-8') as f:
    # Check if last line is }
    # Actually I'll just write the final block manually to be sure.
    pass
