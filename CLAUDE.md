# n8n Workflow Builder - Guide pour Claude

## Description du Projet

Ce projet est dédié à la création de workflows d'automatisation n8n de haute qualité avec l'assistance de Claude. L'objectif est de construire des workflows robustes, bien structurés et maintenables en utilisant les outils spécialisés n8n.

## Installation et Configuration

### ✅ Statut de l'Installation

- ✅ **Serveur MCP n8n** : Configuré dans `.mcp.json`
- ✅ **Skills n8n** : Plugin `n8n-mcp-skills` installé

### Étapes d'Installation

#### 1. Serveur MCP n8n (Déjà configuré ✅)

Le fichier `.mcp.json` a été créé à la racine du projet avec la configuration suivante :

```json
{
  "mcpServers": {
    "n8n": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "n8n-mcp"],
      "env": {
        "MCP_MODE": "stdio"
      }
    }
  }
}
```

**Pour activer le serveur MCP** :
- Redémarrez Claude Code ou rechargez le projet
- Vérifiez l'activation avec la commande `/mcp`

**Pour connexion à une instance n8n locale** (optionnel) :
Ajoutez dans la section `env` du `.mcp.json` :
```json
"N8N_API_URL": "http://localhost:5678",
"N8N_API_KEY": "votre_clé_api"
```

#### 2. Skills n8n (Installé ✅)

**Plugin installé** : `n8n-mcp-skills`

Le plugin a été installé avec succès via la commande `/plugin`.

**Les 7 skills n8n sont maintenant actifs** :
- ✅ n8n Expression Syntax
- ✅ n8n MCP Tools Expert
- ✅ n8n Workflow Patterns
- ✅ n8n Validation Expert
- ✅ n8n Node Configuration
- ✅ n8n Code JavaScript
- ✅ n8n Code Python

Ces skills s'activent automatiquement selon le contexte et sont prêts à l'emploi.

**Note** : Si vous ajoutez de nouveaux plugins n8n, utilisez simplement `/plugin` dans Claude Code.

## Outils Disponibles

### 1. Serveur MCP n8n (`n8n-mcp`)

**Repository**: [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp)

Le serveur MCP n8n donne accès à :
- **1 084 nœuds n8n** (537 core + 547 community)
- **2 709 modèles de workflows** avec métadonnées complètes
- 99% de couverture des propriétés des nœuds
- 87% de couverture documentaire officielle

### 2. Plugin n8n Skills (`n8n-mcp-skills`)

**Plugin installé** : `n8n-mcp-skills` (basé sur [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills))

Les 7 skills complémentaires pour construire des workflows impeccables :

1. **n8n Expression Syntax** - Maîtrise de la syntaxe {{}} et variables ($json, $node, $now)
2. **n8n MCP Tools Expert** - Utilisation efficace des outils MCP
3. **n8n Workflow Patterns** - 5 modèles architecturaux éprouvés
4. **n8n Validation Expert** - Interprétation et correction des erreurs
5. **n8n Node Configuration** - Configuration correcte des nœuds
6. **n8n Code JavaScript** - Écriture de code JS dans les nœuds Code
7. **n8n Code Python** - Écriture de code Python

## Directives de Travail

### Utilisation Systématique des Outils

**TOUJOURS** utiliser les outils n8n-mcp et n8n-skills pour :
- Rechercher des nœuds appropriés
- Configurer correctement les nœuds
- Écrire des expressions n8n valides
- Valider les configurations de workflow
- Suivre les patterns architecturaux recommandés

Les skills s'activent automatiquement selon le contexte, mais peuvent être invoqués explicitement si nécessaire.

### Processus de Création de Workflow

1. **Analyse des Besoins**
   - Comprendre l'objectif du workflow
   - Identifier les déclencheurs (webhook, planification, etc.)
   - Lister les opérations nécessaires

2. **Recherche des Nœuds**
   - Utiliser les outils MCP pour trouver les nœuds appropriés
   - Vérifier la documentation des nœuds
   - Consulter les modèles de workflows similaires

3. **Construction du Workflow**
   - Suivre les patterns architecturaux appropriés :
     - **Webhook Pattern** : pour APIs et intégrations temps réel
     - **HTTP API Pattern** : pour récupération de données externes
     - **Database Pattern** : pour opérations CRUD
     - **AI Pattern** : pour workflows d'IA/LLM
     - **Schedule Pattern** : pour tâches récurrentes

4. **Configuration des Nœuds**
   - Utiliser les skills de configuration
   - Valider chaque configuration
   - Tester les expressions n8n

5. **Validation et Test**
   - Utiliser le Validation Expert pour détecter les erreurs
   - Corriger les problèmes avant déploiement
   - Documenter le workflow

### Règles de Sécurité ⚠️

**CRITIQUE** :
- ❌ **NE JAMAIS modifier directement les workflows de production**
- ✅ **TOUJOURS dupliquer le workflow avant modification**
- ✅ **TOUJOURS tester en environnement de développement**
- ✅ **TOUJOURS exporter des sauvegardes**
- ✅ **TOUJOURS valider les modifications avant déploiement**

### Bonnes Pratiques

#### Expressions n8n
- Utiliser la syntaxe `{{}}` pour les expressions
- Privilégier `$json` pour les données du nœud actuel
- Utiliser `$node["NomNoeud"].json` pour référencer d'autres nœuds
- Utiliser `$now` pour les dates/heures actuelles

#### Structure des Nœuds
- Nommer clairement chaque nœud (ex: "Get User Data", "Transform Response")
- Grouper logiquement les nœuds par fonctionnalité
- Ajouter des notes pour documenter la logique complexe
- Gérer les erreurs avec des branches d'erreur appropriées

#### Code JavaScript/Python
- Privilégier les nœuds natifs quand possible
- Commenter le code personnalisé
- Valider les données d'entrée
- Gérer les cas d'erreur

## Structure du Projet

```
n8n_builders/
├── CSV LBC/           # Fichiers CSV exportés
├── JSON LBC/          # Fichiers JSON exportés
├── BDD Modèles/       # Bases de données de référence
└── CLAUDE.md          # Ce fichier
```

## Workflows Typiques

### 1. Workflows de Scraping/Collecte de Données
- Utiliser HTTP Request pour récupérer les données
- Transformer avec Code/Set nodes
- Stocker dans CSV/JSON ou base de données
- Planifier avec Schedule Trigger

### 2. Workflows d'Enrichissement de Données
- Charger les données sources
- Appeler des APIs externes pour enrichissement
- Fusionner et transformer les données
- Exporter les résultats enrichis

### 3. Workflows d'Automatisation
- Déclencheur webhook ou planifié
- Logique conditionnelle avec IF nodes
- Opérations multiples en parallèle
- Notifications et rapports

## Ressources

- **Documentation n8n** : Accessible via les outils MCP
- **Modèles de workflows** : 2 709 modèles disponibles via MCP
- **Community nodes** : 547 nœuds communautaires documentés

## Notes Importantes

- Les skills n8n travaillent ensemble automatiquement
- Un seul prompt peut activer plusieurs skills complémentaires
- La documentation est mise à jour et couvre 87% du contenu officiel
- La télémétrie anonyme est activée par défaut (désactivable avec `N8N_MCP_TELEMETRY_DISABLED=true`)

---

**Version**: 1.1
**Dernière mise à jour**: 2026-02-15 (Plugin n8n-mcp-skills installé)
