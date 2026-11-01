# Dartsclub Lentjheuvel

Scorebord-app voor de dartsclub: teams, competitie- en bekeravonden, live scores voor 501, 701 en Tac-tic, gedeeld tussen tablets.

**Adres:** https://dartsclub-lentjheuvel.web.app

## Hoe updates online komen
Elke wijziging wordt eerst automatisch gecontroleerd (`tests/run.mjs`). Faalt een controle, dan gaat er niets online.

- **Testversie:** wijzigingen op de branch `test` komen op een apart testadres
  (https://dartsclub-lentjheuvel--test-fgakqiwy.web.app). Bij elke testdeploy krijgt de testversie een
  verse kopie van de echte teams, avonden en instellingen (in `test_teams`, `test_matches`, `test_settings`).
  Testen raakt de echte app dus nooit. Koppelingen en codes zijn wel gedeeld.
- **Echte app:** wijzigingen op `main` komen online voor alle tablets.
  Op het teamoverzicht verschijnt dan "Nieuwe versie beschikbaar"; tik erop om bij te werken.
  Tijdens een partij verschijnt die melding nooit.

De database-regels (`firestore.rules`) gaan automatisch mee, maar pas nadat ze in de Firestore-emulator
gecontroleerd zijn. Ze gelden voor de echte app en de testversie samen.

## Tablet koppelen
- iPad: open het adres in Safari → Deel-knop → "Zet op beginscherm". Open de app via het icoon en voer de clubcode in.
- Android: open het adres in Chrome → menu (⋮) → "App installeren". Open de app via het icoon en voer de clubcode in.
De code hoeft per tablet maar één keer. Koppel altijd vanuit het icoon, niet vanuit de browser.

## Beheer
- Tablet ontkoppelen: Firebase-console → Firestore → `devices` → verwijder het document van die tablet.
- Clubcode wijzigen: Firestore → `config` → `access` → veld `code`.
- Beheerpagina: op een beheer-apparaat de titel 2 seconden ingedrukt houden. Een nieuw apparaat (ook de app op het beginscherm) wordt beheerder door de titel 6 seconden ingedrukt te houden en de beheercode in te voeren (`config` → `admin` → `code`), of via het adres …/#beheer.
- Beheerrechten intrekken: Firestore → `admins` → verwijder het document van die tablet.
