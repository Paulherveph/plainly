# Plainly : lire ses papiers dans une deuxième langue

## Le problème

Un bail en français, un courrier de la préfecture, une offre d'emploi pleine de clauses. Quand on lit lentement la langue du document, le risque est dans ce qu'on rate : un dépôt à verser sous neuf jours, un bail qui se renouvelle si l'on n'écrit pas trois mois avant, une clause de non-concurrence passée inaperçue. Un traducteur donne les mots, sans dire quoi faire ni avant quand.

Plainly prend un document et rend un résumé clair, les faits clés, les actions avec leurs dates, les clauses à surveiller, et une discussion qui répond uniquement à partir de ce document. L'explication est en anglais, en français ou en chinois, quelle que soit la langue d'origine.

## Les contraintes

- **Confidentialité.** On y dépose des documents avec son adresse, son salaire ou sa situation de séjour. Les fichiers sont dans un stockage privé protégé par la sécurité au niveau des lignes, s'ouvrent par des liens signés valables 60 secondes, et sont supprimés après 30 jours ou en un clic. Le texte des documents n'apparaît jamais dans les logs.
- **Coût.** On peut essayer sans compte, il faut donc borner l'usage : 10 Mo et 20 pages par fichier, 5 analyses par jour pour un invité et 20 pour un membre, une analyse mise en cache par document et par langue.
- **Confiance.** Un modèle qui invente une échéance est pire que pas d'outil du tout. Chaque affirmation doit pouvoir être vérifiée.

## Les choix clés

1. **Claude lit le fichier d'origine.** Pas de chaîne OCR, pas de base vectorielle. Le PDF ou la photo part tel quel au modèle ; le texte des pages n'est extrait que pour vérifier les citations.
2. **La vérification des citations décide de ce qui s'affiche.** Chaque fait, action et alerte porte une citation exacte. L'application la cherche dans le texte de la page, en ignorant espaces, casse et coupures de mots. Si elle n'y est pas, le point est retiré et la page l'indique. La discussion suit la même règle : sans citation vérifiée, pas de réponse.
3. **Ports et adaptateurs.** Les cas d'usage dépendent d'interfaces. Chaque port d'IA a un adaptateur Claude et un faux déterministe : toute l'application, tests de bout en bout compris, tourne hors ligne et gratuitement.
4. **Les invités d'abord.** Un compte anonyme est créé à la première ouverture de l'application, et les documents sont conservés à la connexion avec Google ou un lien e-mail.

## Les résultats

- 66 tests unitaires et de cas d'usage, 24 assertions en base qui prouvent qu'un utilisateur ne peut ni lire ni modifier les lignes d'un autre, 19 tests de bout en bout sur ordinateur et mobile.
- Un jeu d'évaluation de 10 documents en trois langues. Sur la base déterministe, 98 % des affirmations passent la vérification et aucune date non écrite n'apparaît. Scores du modèle réel : _à ajouter après le premier passage avec une clé d'API_.
- Lighthouse sur mobile : accessibilité 100, bonnes pratiques 100, performance de 93 à 96, LCP mesuré autour d'une demi-seconde.
- Code par couche : domaine 508 lignes, application 561, infrastructure 1 158, interface 1 756.
- Vidéo de démonstration : _à ajouter_.

## Et ensuite

Comparer deux versions d'un document et montrer ce qui a changé, envoyer un rappel par e-mail avant une échéance, et lancer l'évaluation à chaque pull request pour qu'un changement de prompt ne fasse pas baisser le taux de vérification sans qu'on le voie.
