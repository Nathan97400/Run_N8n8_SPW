# Solution : Traitement par Lots avec Split In Batches

## Problème
Les nœuds de matching traitent trop de données simultanément, causant un timeout après 30 secondes.

## Solution : Utiliser le Nœud Natif "Split In Batches"

### Étape 1 : Ajouter le Nœud "Split In Batches"

**Position dans le workflow** :
```
Extraction JSON Leboncoin2
          ↓
    Remove Duplicates
          ↓
    Filter Empty Rows2
          ↓
   🆕 SPLIT IN BATCHES (nouveau nœud)
          ↓
   Merge Annonces + Modèles
          ↓
        ...
```

### Étape 2 : Configuration du Nœud "Split In Batches"

1. **Ajouter le nœud** :
   - Dans n8n, cliquez sur "+" après "Filter Empty Rows2"
   - Cherchez "Split In Batches"
   - Sélectionnez le nœud natif n8n

2. **Paramètres** :
   ```
   Batch Size: 20
   Options:
     - Reset: true (pour réinitialiser entre exécutions)
   ```

### Étape 3 : Reconnecter le Workflow

**IMPORTANT** : Le nœud "Split In Batches" a besoin d'une **boucle** :

```
Split In Batches
     ↓
Merge Annonces + Modèles
     ↓
⭐ Scoring de Complétude
     ↓
⭐ Router par Qualité
     ↓
[1st/2nd/3rd/4th/5th Match]
     ↓
Merge All Matches
     ↓
Rename Columns
     ↓
Create a row1
     ↓
🔄 RETOUR vers "Split In Batches" (output 1)
```

### Configuration JSON du Nœud

```json
{
  "name": "Split In Batches",
  "type": "n8n-nodes-base.splitInBatches",
  "typeVersion": 3,
  "position": [0, 1000],
  "parameters": {
    "batchSize": 20,
    "options": {
      "reset": true
    }
  }
}
```

### Connexions

Le nœud "Split In Batches" a **2 sorties** :

- **Sortie 0** : Batch en cours → vers "Merge Annonces + Modèles"
- **Sortie 1** : Boucle → reconnecte à "Split In Batches" pour batch suivant

**Exemple de connexion** :
```json
"Split In Batches": {
  "main": [
    [
      {
        "node": "Merge Annonces + Modèles",
        "type": "main",
        "index": 0
      }
    ]
  ]
},
"Create a row1": {
  "main": [
    [
      {
        "node": "Split In Batches",
        "type": "main",
        "index": 1
      }
    ]
  ]
}
```

## Avantages

✅ **Évite les timeouts** : Traite 20 annonces à la fois au lieu de toutes
✅ **Performances optimales** : Nœud natif optimisé par n8n
✅ **Moins de mémoire** : Charge seulement 20 items en mémoire à la fois
✅ **Monitoring** : Voir la progression batch par batch

## Alternative : Augmenter le Timeout

Si vous ne pouvez pas restructurer le workflow, augmentez le timeout :

```bash
# Dans votre fichier .env ou configuration n8n
N8N_RUNNERS_HEARTBEAT_INTERVAL=60000  # 60 secondes au lieu de 30
```

**⚠️ Attention** : Ceci est un palliatif, pas une solution. Le traitement par lots reste recommandé.
