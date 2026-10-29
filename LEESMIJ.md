# Dartsclub Lentjheuvel

Scorebord-app voor de dartsclub: teams, competitie- en bekeravonden, live scores voor 501, 701 en Tac-tic, gedeeld tussen tablets.

**Adres:** https://dartsclub-lentjheuvel.web.app

## Hoe updates online komen
Elke wijziging op de `main`-branch wordt automatisch online gezet door GitHub Actions
(`.github/workflows/deploy.yml`). Volg het onder het tabblad **Actions** op GitHub.
Na ongeveer een minuut halen de tablets de nieuwe versie op bij de volgende keer openen.

Handmatig online zetten vanaf de pc kan nog steeds:
```
cd $HOME\Coding\dartsclub-lentjheuvel
firebase deploy --only hosting
```
De database-regels (`firestore.rules`) gaan niet automatisch mee. Na een wijziging daarin:
```
firebase deploy --only firestore:rules
```

## Tablet koppelen
- iPad: open het adres in Safari → Deel-knop → "Zet op beginscherm". Open de app via het icoon en voer de clubcode in.
- Android: open het adres in Chrome → menu (⋮) → "App installeren". Open de app via het icoon en voer de clubcode in.
De code hoeft per tablet maar één keer. Koppel altijd vanuit het icoon, niet vanuit de browser.

## Beheer
- Tablet ontkoppelen: Firebase-console → Firestore → `devices` → verwijder het document van die tablet.
- Clubcode wijzigen: Firestore → `config` → `access` → veld `code`.
- Beheerpagina (best of per divisie): houd de titel 2 seconden ingedrukt en voer de beheercode in (`config` → `admin` → `code`).
- Beheerrechten intrekken: Firestore → `admins` → verwijder het document van die tablet.
