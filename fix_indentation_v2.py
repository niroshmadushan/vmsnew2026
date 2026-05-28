import sys
import os

filename = r'c:\Users\NiroshMadushan\Documents\VMS NEW ONE\vmssystem (7) (3)\components\admin\booking-management.tsx'

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_old_participants = False

# Part 1: Fix the duplicate keepFetching and start de-indenting
for i, line in enumerate(lines):
    # Fix the duplicate keepFetching = false
    if i == 1111 and 'keepFetching = false' in line and (i+1 < len(lines) and 'keepFetching = false' in lines[i+1]):
        # Skip this line to remove duplicate
        continue

    # De-indent code from line 1164 onwards (which is the swallowed code)
    # Actually line 1164 starts de-indenting in my previous script's output
    if i >= 1163: # adjustments after the previous script
        # Check if line has at least 10 spaces
        if line.startswith('          '):
             # Add 2 spaces of indentation (standard component level)
             new_lines.append('  ' + line[10:])
        elif line.strip() == '':
             new_lines.append('\n')
        else:
             # Just add 2 spaces to whatever is there
             new_lines.append('  ' + line.lstrip())
    else:
        new_lines.append(line)

# Part 2: Remove the duplicate old loadBookingParticipants
# It was at line 2433 in the previous view_file.
# But since we shifted lines, we should find it by content.
final_lines = []
skip = 0
for i, line in enumerate(new_lines):
    if skip > 0:
        skip -= 1
        continue
        
    if 'const loadBookingParticipants = async (bookingId: string) => {' in line and i > 2000:
        # Check if this is the OLD one (contains SIMULATE or NEXT_PUBLIC_APP_ID stuff)
        # The new one is at 1129 (approx)
        found_old = False
        for j in range(i, min(i + 50, len(new_lines))):
            if 'NEXT_PUBLIC_APP_ID' in new_lines[j] or 'Simulate successful response' in new_lines[j]:
                found_old = True
                break
        
        if found_old:
            # Skip until the end of this function
            # The function ends with:
            # } finally {
            #   setIsLoadingParticipants(false)
            # }
            # }
            
            # Find the end
            end_index = i
            brace_count = 0
            started = False
            for j in range(i, len(new_lines)):
                brace_count += new_lines[j].count('{')
                brace_count -= new_lines[j].count('}')
                if '{' in new_lines[j]: started = True
                if started and brace_count == 0:
                    end_index = j
                    break
            
            skip = end_index - i + 1
            continue
            
    final_lines.append(line)

with open(filename, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print("Fixed duplicates and indentation.")
