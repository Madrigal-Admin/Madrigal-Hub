# Igiena tehnică la dezvoltare — HUB Madrigal și platforma Cantus Mundi

Copie a documentului `igiena-dezvoltare.md` din proiectul Claude. Se ține sincronizată cu el. Verificările periodice (backup, conturi, costuri, RLS) sunt în `igiena-tehnica-hub.md`.

## 1. La orice modificare (înainte de livrare)
1. `npm run lint` fără erori.
2. `npm run build` reușește.
3. Cod mort șters pe loc: pagini, componente, funcții, rute nefolosite. Istoricul rămâne în GitHub.
4. Redirecturile se țin doar pentru adrese deja folosite public; pentru adrese interne se șterge ruta veche.
5. Fiecare fișier are un singur rol. O pagină nouă = un fișier nou.
6. Texte, culori, meniuri și liste de valori se țin în baza de date sau într-un fișier de configurare, nu împrăștiate prin cod.
7. README și acest document se actualizează în aceeași livrare cu schimbarea.

## 2. La orice modificare în baza de date
1. Doar prin migrări numerotate; o migrare rulată nu se mai modifică, se adaugă una nouă.
2. Tabel nou: RLS pornit și grant-uri explicite în aceeași migrare; implicit nimic public.
3. Drepturile se impun în baza de date (RLS și funcții `security definer`), nu doar prin ascunderea unui buton.
4. Orice acțiune care schimbă rolul sau statusul unui cont trece printr-o funcție verificată.
5. Backup înainte de orice migrare pe date reale.
6. În migrare nu apar parole, chei sau date personale reale.

## 3. Securitate și secrete
- În repo nu intră niciodată `service_role`, cheia Brevo sau parole. Pe Netlify se pun doar `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY`.
- Variabilele `VITE_*` sunt vizibile oricui în browser: nimic secret nu are voie să le folosească.
- Date personale: doar ce e necesar. Fără CNP.

## 4. Lunar / la trei luni
- `npm audit` și actualizarea versiunilor minore, cu testare înainte de publicare. Actualizările majore (React, Vite) se planifică o dată pe an.
- Se verifică în Supabase, la Advisors, avertismentele de securitate.
- Tabelele sau rutele rămase nefolosite se șterg, după backup.

## 5. Avertismente cunoscute
- `npm audit` raportează probleme în `vite` și `esbuild` (5.x / 0.21); afectează doar serverul de dezvoltare local, nu site-ul publicat. Se rezolvă prin actualizarea majoră a lui Vite, planificată o dată pe an.
