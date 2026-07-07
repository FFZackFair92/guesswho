# Indovina Chi 3D — Analisi dei costi per il lancio

## Perché l'app costa poco da far girare

L'architettura è pensata per scaricare quasi tutto il traffico pesante dai tuoi server:

- **Le partite sono P2P** (WebRTC/PeerJS): domande, mosse e perfino le foto delle board custom
  viaggiano direttamente tra i due giocatori. Il tuo server non tocca quel traffico.
- **Le foto dei personaggi famosi** arrivano da Wikipedia/Wikidata: banda a costo zero per te.
- **Il client è statico** (un file HTML): può essere servito dal server stesso o da un CDN gratuito.

Il tuo server fa solo: elenco lobby, abbinamento giocatori, classifica punti. Sono richieste JSON
minuscole (~1 KB) con un heartbeat ogni 2,5 secondi per giocatore attivo. Un piccolo VPS ne regge migliaia.

L'unica voce "nascosta" da conoscere: ~10-15% delle connessioni P2P fallisce dietro reti
aziendali/mobile restrittive e richiederebbe un relay **TURN**. Il traffico di gioco è talmente
piccolo (qualche KB, più ~1 MB una tantum per le board custom) che un TURN self-hosted sullo
stesso VPS costa praticamente nulla. Al lancio si può partire senza e aggiungerlo dopo.

## Costi per fasce di utenza

Stime prudenti. "Utenti concorrenti" = collegati nello stesso momento (di solito il 3-5% degli utenti attivi giornalieri).

### Fase 0 — Test con amici (0 → 500 utenti/mese, ~10-25 concorrenti)
| Voce | Costo |
|---|---|
| Server: Render.com piano Free | **0 €** |
| Client servito dallo stesso server | 0 € |
| Signaling PeerJS: cloud pubblico gratuito | 0 € |
| **Totale** | **0 €/mese** |

Limite: il server free "dorme" dopo 15 min di inattività (primo accesso lento ~30 s) e la RAM è poca. Perfetto per validare l'idea, non per un lancio vero.

### Fase 1 — Lancio (500 → 20.000 utenti/mese, ~50-500 concorrenti)
| Voce | Costo |
|---|---|
| VPS 2 vCPU / 4 GB (Hetzner CX22 ~4,5 €, DigitalOcean ~6 $) | **~5-7 €/mese** |
| Dominio .it/.com | ~10 €/anno (~1 €/mese) |
| HTTPS (Let's Encrypt via Caddy/Nginx) | 0 € |
| Signaling PeerJS self-hosted sullo stesso VPS | 0 € |
| TURN (coturn) sullo stesso VPS, ~100-300 GB inclusi nel VPS | 0 € |
| **Totale** | **~6-8 €/mese** |

Un singolo VPS a questo prezzo regge senza problemi 500 heartbeat concorrenti (≈200 richieste/secondo di picco): il collo di bottiglia non è la CPU ma la RAM per le board custom in memoria (~1 MB a lobby → 4 GB = migliaia di lobby).

### Fase 2 — Crescita (20.000 → 200.000 utenti/mese, ~500-5.000 concorrenti)
| Voce | Costo |
|---|---|
| VPS 4-8 vCPU / 16 GB oppure 2 VPS + load balancer | ~20-40 €/mese |
| Database (Postgres gestito o SQLite su volume) per classifiche persistenti | 0-15 €/mese |
| TURN dedicato (se molte reti mobili): banda ~1-2 TB | ~5-10 €/mese |
| CDN per il client (Cloudflare free) | 0 € |
| **Totale** | **~30-60 €/mese** |

### Fase 3 — Successo (>200.000 utenti/mese)
A quel punto conviene rifattorizzare il matchmaking su infrastruttura serverless con stato
(Cloudflare Workers + Durable Objects: ~5 $/mese base + ~0,15 $/milione di richieste) o su un
cluster di 2-3 VPS. Ordine di grandezza: **100-300 €/mese** per milioni di partite. Se arrivi
qui, i costi saranno l'ultimo dei tuoi problemi.

## Voci da NON dimenticare per un lancio pubblico
- **Account sviluppatore store** (quando faremo le app native): Google Play 25 $ una tantum, Apple 99 $/anno.
- **Diritti d'immagine**: le foto da Wikipedia hanno licenze libere (con attribuzione) ma l'uso di
  volti di persone reali in un'app commerciale può richiedere cautele legali (diritto d'immagine),
  soprattutto se monetizzi. Da approfondire prima degli store; una via sicura è passare a
  caricature/illustrazioni per i pack ufficiali.
- **Privacy/GDPR**: con le lobby custom gli utenti si scambiano foto personali via P2P (il server le
  tiene solo in RAM per la durata della lobby): serve comunque una privacy policy.

## Raccomandazione
Parti con **Fase 0 (0 €)** per i test con amici, poi al lancio passa a **1 VPS Hetzner da ~5 €/mese**
con client, matchmaking, PeerJS e TURN tutti sulla stessa macchina. Scala solo quando i numeri lo chiedono.
