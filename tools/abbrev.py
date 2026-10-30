"""Full forms of the call sheets' abbreviations, so answers count either way.

annotate() adds to each callout:
  slots  one [word, full forms, short forms] per word of the name
         ("Kitch H" -> [["Kitch", ["Kitchen"], []], ["H", ["Hallway"], []]];
         "Kitchen" -> [["Kitchen", [], ["Kitch"]]]).
         The app accepts any mix: "kitchen h", "kitch hallway", "kitchen hallway".
  full   the name with every abbreviation written out ("Kitchen Hallway"), shown
         when an answer is revealed. Left out when nothing in the name is short.
  broad  less specific answers that still count ("Showers" for "S1").

The abbreviations come from the team. Names that aren't short for anything (Emo,
Dias and Achieved are pro players, K9, AK, PRO, CC on Border, J desk and L desk) stay
exactly as written on the call sheet.
"""
import re

# Abbreviations on every map: word -> full forms (the first one is shown).
WORDS = {
    'h': ['Hallway'],
    'l': ['Long'],
    'hp': ['Harry Potter'],
    'kitch': ['Kitchen'],
    'sqr': ['Square'],
    'caf': ['Cafeteria'],
    'mez': ['Mezzanine'],
    'mezz': ['Mezzanine'],
    'recep': ['Reception'],
    'balc': ['Balcony'],
    'logi': ['Logistics'],
    'ops': ['Operations', 'Operation'],
    'e-box': ['Electrical box', 'Electric box'],
    'dmz': ['Dead Man Zone'],
    '½': ['Half'],
}

# Full words that also appear shortened on the sheets: accepted, never shown.
SHORT = {'hall': ['H'], 'stairs': ['S']}

# B2: the bathroom on 2F, where a map has several bathrooms.
BATHROOM_2F = ['Bathroom 2nd floor', 'Bathroom 2', 'Bathroom 2F', '2nd floor bathroom',
               '2F bathroom', 'Second floor bathroom', 'Bathroom second floor']

# Abbreviations used on one map only. An empty list keeps a word as written there.
MAP_WORDS = {
    'border': {'l': [], 'b': ['Break']},  # L desk is L-shaped, not long; B desk is Break desk
    'chalet': {'sol': ['Solar'], 'p': ['Piano']},  # P ½ W
    'clubhouse': {'j': ['Juke'], 'r': ['Rafters'], 'con': ['Construction'], 'b2': BATHROOM_2F},
    'villa': {'w': ['Wall']},  # Triple w
    'nighthaven': {'con': ['Connector'], 'cc': ['Command Center']},
    'bank': {'cc': ['CCTV']},
    'lair': {'gen': ['Generator'], 'b2': BATHROOM_2F},
}

# Letter + number on one map: "K2" -> "Kitchen 2".
NUMBERED = {
    'border': {'s': ['Shower', 'Showers']},  # S1, S2 in the showers
    'clubhouse': {'r': ['Rafters']},         # R90
    'nighthaven': {'s': ['Storage'], 'r': ['Rafters']},
    'bank': {'e': ['Elevator']},             # E1, E2 Hall, E3
    'kafe': {'c': ['Cocktail'], 'f': ['Freezer'], 'p': ['Pillar'], 'k': ['Kitchen'],
             'r': ['Red'], 'b': ['Box']},
    'lair': {'l': ['Lab', 'Labs']},
}

# Less specific answers that still count: map -> callout -> answers.
BROAD = {
    'border': {'S1': ['Showers'], 'S2': ['Showers']},
    'kafe': {'Red S1': ['Red Stairs', 'Red S'], 'Red S2': ['Red Stairs', 'Red S'], 'Red S3': ['Red Stairs', 'Red S'],
             'C1': ['Cocktail'], 'C2': ['Cocktail'], 'C3': ['Cocktail']},
    'nighthaven': {'S1': ['Storage'], 'S2': ['Storage'],
                   'R1': ['Rafters'], 'R2': ['Rafters'], 'R3': ['Rafters']},
    'lair': {'L1': ['Lab', 'Labs'], 'L2': ['Lab', 'Labs'], 'L3': ['Lab', 'Labs']},
}


def shortenings(map_id):
    """Full word -> its abbreviations ("kitchen" -> ["Kitch"]), so a name written
    out also takes its short form. One-letter ones are left to SHORT and context."""
    out = {}
    for short, fulls in {**WORDS, **MAP_WORDS.get(map_id, {})}.items():
        for f in fulls:
            if ' ' not in f and len(short) > 1 and short != '½':
                out.setdefault(f.lower(), []).append(short.capitalize())
    return out


def word_forms(map_id, words, i):
    """(full forms, short forms) for words[i] of a callout name."""
    w, k = words[i], words[i].lower()
    nxt = words[i + 1].lower() if i + 1 < len(words) else None
    first, last = i == 0, i == len(words) - 1
    here = MAP_WORDS.get(map_id, {})
    full = list(here[k] if k in here else WORDS.get(k, []))
    short = list(SHORT.get(k, [])) if not (k == 'stairs' and first) else []
    num = re.fullmatch(r'([a-z])(\d+)', k)
    if k == 's':
        # S is "short" before H ("Fountain S H"), "stairs" after a word ("Main S")
        full = ['Short'] if nxt == 'h' else ['Stairs'] if last and not first else []
    elif num and num[1] == 's' and not first:
        full = [f'Stairs {num[2]}']  # "Red S1" on Kafe
    elif num and not full:
        full = [f'{f} {num[2]}' for f in NUMBERED.get(map_id, {}).get(num[1], [])]
    elif k == 'e' and nxt == 'box':
        full = ['Electrical', 'Electric']
    elif k == 'w' and i > 0 and words[i - 1] == '½':
        full = ['Wall']
    elif k == 'wall' and i > 0 and words[i - 1].lower() in ('half', '½'):
        short = ['W']  # Half Wall as ½ W
    # the word's other spellings: Kitchen as Kitch, Mez as Mezz, Operation as Ops
    abbr = shortenings(map_id)
    for f in full or [w]:
        short += [a for a in abbr.get(f.lower(), []) if a.lower() != k and a not in short]
    return full, short


def annotate(map_id, c):
    words = c['name'].split()
    slots, shown, changed = [], [], False
    for i, w in enumerate(words):
        full, short = word_forms(map_id, words, i)
        slots.append([w, full, short])
        shown.append(full[0] if full else w)
        changed |= bool(full)
    if any(full or short for _, full, short in slots):
        c['slots'] = slots
    if changed:
        c['full'] = ' '.join(shown)
    extra = BROAD.get(map_id, {}).get(c['name'], [])
    if extra:
        c['broad'] = c.get('broad', []) + [b for b in extra if b not in c.get('broad', [])]
    return c


if __name__ == '__main__':  # print every expansion for review
    import json, sys
    data = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'src/callouts.json'))
    for m in data['maps']:
        for f in m['floors']:
            for c in f['callouts']:
                annotate(m['id'], c)
                if 'full' in c or c.get('broad'):
                    print(f"{m['id']:10s} {f['name']:8s} {c['name']:16s} -> {c.get('full', '-'):26s} broad {c.get('broad', [])}")
