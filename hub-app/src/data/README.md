# siruta.json

Lista județelor și localităților din România, pentru alegerea localității în Calendar.

- Sursa: SIRUTA (Institutul Național de Statistică), semestrul I 2026, preluată prin pachetele npm
  `@nspot/geo-pack-romania-uat` și `@nspot/geo-pack-romania-localities` (denumiri cu diacritice ș, ț).
- Conținut: 42 de județe (41 + București), 3.181 UAT-uri (municipii, orașe, comune) și localitățile lor (sate și localități componente).
- Format: `judete` = nume; `uat` = [nume, index județ, tip]; `loc` = [nume, index județ, index UAT, cod SIRUTA].
- București apare o singură dată („București", județ „București"); sectoarele nu sunt separate.
- Se încarcă doar când se deschide formularul de eveniment (nu face parte din pagina principală).
- Actualizare: înlocuiește fișierul cu o versiune nouă, păstrând formatul. Valorile deja salvate în baza de date rămân text.
