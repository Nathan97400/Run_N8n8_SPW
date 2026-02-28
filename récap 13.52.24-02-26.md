# Récap session — 13h52, 24/02/2026

## Ce qui a été accompli

### Bugs corrigés
- **`matched_ok` toujours FALSE** → corrigé : le noeud "Rename Columns" ne retransmettait pas les champs `matched_ok`, `matched_confidence` et `matching_engine` — ajoutés explicitement dans `mapField()`
- **Noeud Supabase cassé** → la version du noeud Supabase installée (n8n 2.8.3) n'a pas l'opération "upsert" et son `tableId` (ResourceLocator) ne pouvait pas être configuré via API → remplacé par deux noeuds **HTTP Request** appelant directement l'API REST Supabase
- **Mapping des colonnes** → les champs LBC (`Nom_annonce`, `Url_Https`, `Prix_affiche`, etc.) sont maintenant mappés vers les colonnes Supabase (`titre`, `url`, `prix`, etc.)
- **`id` généré** depuis le numéro d'annonce LBC extrait de l'URL (ex: `.../3060494324` → `id = "3060494324"`) — déterministe pour les upserts

### Infrastructure Supabase
- Table `annonces_claude_code_n8n` créée avec le bon schéma
- Upsert configuré sur la colonne `url` (`on_conflict=url`)
- 3 annonces matchées insérées avec succès :
  - KTM 790 Duke — 5 990€
  - Piaggio MP3 500 HPE — 5 990€
  - Harley-Davidson Sportster 1200 — 6 900€

### Workflow déployé
- Nom : **LBC Scraping - Progressive Matching v3 (STABLE)**
- Instance : `https://n8n-t0fe.onrender.com`
- ID workflow : `ssvlV5ZZsZemSOUB`

---

## État actuel du pipeline

| Etape | Statut |
|---|---|
| Gmail Trigger → Extraction LBC | ✅ Fonctionnel |
| Scoring de complétude + Router par qualité | ✅ Fonctionnel |
| GET Modeles (workers.dev) | ✅ 1788 modèles chargés |
| Merge EXCELLENT + 1st Match | ✅ Fonctionnel |
| Merge chain (5 tiers) | ✅ Fonctionnel |
| Rename Columns | ✅ Corrigé |
| IF Matched OK ? | ✅ Fonctionnel — **3 TRUE / 215 FALSE** |
| HTTP Request → Supabase upsert | ✅ Fonctionnel |

---

## To-Do List

- [x] **Router par qualité : 100% des items vont dans EXCELLENT** — **DIAGNOSTIQUÉ** (exec1_raw.json analysé)

  **Cause réelle (3 bugs distincts) :**

  **Bug #1 — Switch v3 routing (critique)** : Le scoring EST correct (214 GOOD / 3 EXCELLENT / 1 MEDIUM sur 218 items, scores 59–84, moyenne 70). Le problème est dans le nœud Switch/Router : `fallbackOutput: null` (non configuré) → n8n v3 envoie **tous les items non-matchés en output 0** (EXCELLENT) au lieu de les discarder. Résultat : 218 items → output 0, 0 items sur les outputs 1–4. Confirmé : le premier item d'output 0 a `data_quality_tier = "GOOD", score = 77`.

  **Bug #2 — Champ description manqué** : Le code cherche `text-body-1 (16)` et `text-body-1 (14)` (toujours vides dans les vraies données), mais la description réelle est dans `text-body-1 (17)` → **0 pts description pour 100% des items** (alors qu'ils devraient avoir 15 pts).

  **Bug #3 — Champ titre erroné** : `get(item, "text-body-1 (8)", "text-headline-1-expanded", ...)` — `text-body-1 (8)` = "Manuelle" (boîte de vitesses !) pris en priorité sur le vrai titre → **3 pts au lieu de 7 pts** (titre riche ignoré).

  **Impact scoring sans ces bugs** : score typique passerait de ~70 (GOOD) à ~96 (EXCELLENT) — presque tous les items seraient légitimement EXCELLENT.

  **Corrections à appliquer :**
  1. Switch node : définir `fallbackOutput: "extra"` (+ connecter l'extra output ou le laisser déconnecté pour discarder)
  2. Description : ajouter `"text-body-1 (17)"` dans la liste de recherche (avant `(16)`)
  3. Titre : inverser la priorité → `get(item, "text-headline-1-expanded", "text-body-1 (8)", ...)`
- [x] **IF Matched OK ? : 3 TRUE / 215 FALSE** — **DIAGNOSTIQUÉ ET CORRIGÉ**

  **Cause #1 — Gate "dominants" bloque tout** : La fonction `getAnnonceTitle` dans les 5 nœuds Match utilisait `text-body-1 (8)` = "Manuelle" (boîte de vitesses) → `adNumbers = []` → les modèles avec un chiffre dans leur nom (`890 Duke`, `MT-09`, `Rocket III`, etc.) échouent tous au gate `p.dominants.some(d => adNumbers.includes(d))` → confidence NONE pour 215 items. **Fix appliqué** : `getAnnonceTitle` utilise désormais `text-headline-1-expanded` en priorité ("KTM 890 DUKE 2021 19 500 Kms" → `adNumbers = [890, 2021]` → gate passe).

  **Cause #2 — Description vide dans Match** : `getAnnonceDesc` cherchait `text-body-1 (16)` (vide) au lieu de `text-body-1 (17)` (description réelle). **Fix appliqué** sur les 5 nœuds Match.

  **Cause #3 — modelHint fallback** : En cas de modèle "Autre", le fallback utilisait `text-body-1 (8)` = "Manuelle" au lieu de `text-headline-1-expanded`. **Fix appliqué**.

  **Taux attendu après correction** : ~60-80% de matches (contre 1.4% avant) car la gate dominants était le principal blocage.

- [x] **Supabase - Annonce A Revoir n'insère pas les 215 items** — **CORRIGÉ**

  **Bug** : La sortie FALSE du nœud "IF Matched OK ?" n'était **pas connectée** à "Supabase - Annonce A Revoir" (`connections["IF Matched OK ?"]["main"][1] = []`). **Fix appliqué** : connexion IF FALSE → Supabase A Revoir rétablie. Paramètres Supabase aussi corrigés (`dataToSend: 'autoMapInputData'`, `conflictColumns: 'Url_Https'`).

- [ ] **Rendre la colonne `kilometrage` nullable dans Supabase** — SQL à exécuter dans le Supabase SQL Editor :
  ```sql
  ALTER TABLE annonces_claude_code_n8n ALTER COLUMN "Kilométrage" DROP NOT NULL;
  ALTER TABLE annonces_claude_code_n8n ALTER COLUMN "Kilométrage" SET DEFAULT NULL;
  ```
  *(Adapter le nom de table si nécessaire — tester avec `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'annonces_claude_code_n8n';`)*

- [ ] **Tester le workflow avec un vrai email Gmail contenant des annonces LBC** — toutes les corrections sont déployées, prêt pour test réel

---

## Notes techniques

- `kilometrage = 0` quand LBC ne fournit pas la donnée (non nullable actuellement)
- Les credentials Supabase sont hardcodées dans les noeuds HTTP Request (à terme : utiliser les credentials n8n)
- Le noeud Supabase v1 de n8n 2.8.3 n'a pas l'opération "upsert" → contourné par HTTP Request
