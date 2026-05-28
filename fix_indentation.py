import sys

filename = r'c:\Users\NiroshMadushan\Documents\VMS NEW ONE\vmssystem (7) (3)\components\admin\booking-management.tsx'

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_mode = False

for i, line in enumerate(lines):
    if i == 1111: # This is the "keepFetching = false" line in the broken loop
        new_lines.append('          keepFetching = false\n')
        new_lines.append('        } else {\n')
        new_lines.append('          currentPage++\n')
        new_lines.append('          if (currentPage > 20) keepFetching = false\n')
        new_lines.append('        }\n')
        new_lines.append('      }\n')
        new_lines.append('\n')
        new_lines.append('      // Sort places alphabetically\n')
        new_lines.append('      const sortedPlaces = allPlacesData.sort((a, b) => a.name.localeCompare(b.name))\n')
        new_lines.append('      setAllPlaces(sortedPlaces)\n')
        new_lines.append('    } catch (error) {\n')
        new_lines.append('      console.error("Failed to fetch all places:", error)\n')
        new_lines.append('    } finally {\n')
        new_lines.append('      setIsLoadingAllPlaces(false)\n')
        new_lines.append('    }\n')
        new_lines.append('  }\n\n')
        
        # Now add the loadBookingParticipants function
        new_lines.append("  // Load participants for email dialog using recursive paging\n")
        new_lines.append("  const loadBookingParticipants = async (bookingId: string) => {\n")
        new_lines.append("    try {\n")
        new_lines.append("      setIsLoadingParticipants(true)\n")
        new_lines.append("      let allParticipantsData = []\n")
        new_lines.append("      let currentPage = 1\n")
        new_lines.append("      let keepFetching = true\n\n")
        new_lines.append("      while (keepFetching) {\n")
        new_lines.append("        const response = await bookingEmailAPI.getParticipants(bookingId, {\n")
        new_lines.append("          limit: 100,\n")
        new_lines.append("          page: currentPage\n")
        new_lines.append("        })\n\n")
        new_lines.append("        const pageData = Array.isArray(response) ? response : response?.data || []\n")
        new_lines.append("        if (pageData.length > 0) {\n")
        new_lines.append("          allParticipantsData = [...allParticipantsData, ...pageData]\n")
        new_lines.append("        }\n\n")
        new_lines.append("        if (pageData.length < 100) {\n")
        new_lines.append("          keepFetching = false\n")
        new_lines.append("        } else {\n")
        new_lines.append("          currentPage++\n")
        new_lines.append("          if (currentPage > 20) keepFetching = false\n")
        new_lines.append("        }\n")
        new_lines.append("      }\n\n")
        new_lines.append("      setBookingParticipants(allParticipantsData)\n")
        new_lines.append("    } catch (error) {\n")
        new_lines.append("      console.error('Failed to load participants for email dialog:', error)\n")
        new_lines.append("    } finally {\n")
        new_lines.append("      setIsLoadingParticipants(false)\n")
        new_lines.append("    }\n")
        new_lines.append("  }\n\n")
        
        skip_mode = True
        continue

    if skip_mode:
        if i < 1148: # My mess ended at 1147
            continue
        else:
            skip_mode = False
            # De-indent
            if line.startswith('          '):
                new_lines.append(line[10:])
            else:
                new_lines.append(line)
            continue
            
    new_lines.append(line)

with open(filename, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed indentation.")
