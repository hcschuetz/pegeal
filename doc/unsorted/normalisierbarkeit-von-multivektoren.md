Normalisierbarkeit von Multivektoren
====================================

Herleitung einer hinreichenden Bedingung für einen Multivektor `M`,
die sicherstellt, dass `normSquared(M) := MM~` ein Skalar ist.

Euklidische Metrik und eine orthonormale Basis wird angenommen.
(Eine ortho***gonale*** Basis und eine positiv-definite Metrik reichen vermutlich
aus.)

    M = sum_i B_i

Wobei die `B_i` skalare Vielfache von Basis-Blades sind.  Wir richten es so ein,
dass jedes Basis-Blade in der Summe nur einmal vorkommt.
(Indem wir Terme, die auf dem gleichen Basis-Blade basieren, zu einem einzigen
Term zusammenfassen.)

    MM~
    = (sum_i B_i)(sum_j B_j)~
    = (sum_i B_i)(sum_j B_j~)
    = sum_{i,j} B_i B_j~
    = sum_i B_i B_i~ + sum_{i<j} (B_i B_j~ + B_j B_i~)

Die Terme der ersten Summe sind nach Konstruktion immer skalar,
die Terme der zweiten Summe sind das nur unter bestimmten Voraussetzungen.

Wir betrachten einen Term der zweiten Summe, wobei wir die Komponenten B_i und
B_j der Kürze halber als A und B bezeichnen.

Fall 1: Wenn `AB~` und `BA~` Skalare sind, dann ist der Summen-Term `AB~ + BA~`
ebenfalls ein Skalar.
Dies ist jedoch nur dann der Fall, wenn `A` und `B` auf dem gleichen
Basis-Blade basieren.
Nach unserer Konstruktion von `M` ist in diesem Fall `A = B` und wird durch
einen Term der ersten Summe abgedeckt.

Fall 2: Ansonsten müssen sich `AB~` und `BA~` aufheben. Dazu muss gelten:

    AB~ + BA~ = 0

also

    AB~ = -BA~

Sei `P := meet(A, B)` und `C`, `D` das was von `A`, `B` jeweils übrig bleibt,
mit passendem Vorzeichen, so dass gilt:

    A = PC
    B = PD

und die drei Basis-Vektor-Mengen von `P`, `C`, `D` sind paarweise disjunkt.

Mit der Funktion `flips: n -> (-1)**n` können wir unsere beiden Produkte
schreiben als

    AB~
    = (PC)(PD)~
    = flips((p + d)(p + d - 1)/2) PCPD
    = flips((p + d)(p + d - 1)/2 + cp) PPCD

    - BA~
    = - (PD)(PC)~
    = - flips((p + c)(p + c - 1)/2) PDPC
    = - flips((p + c)(p + c - 1)/2 + dp + cd) PPCD
    = flips((p + c)(p + c - 1)/2 + dp + cd + 1) PPCD

Um `AB~ = -BA~` zu erreichen muss gelten (mit Infix `~` für Äquivalenz modulo 2):

    (p + d)(p + d - 1)/2 + cp ~ (p + c)(p + c - 1)/2 + dp + cd + 1
    (p + d)(p + d - 1)/2 + cp - (p + c)(p + c - 1)/2 - dp - cd ~ 1
    (pp + 2dp + dd - p - d)/2 + cp - (pp + 2cp + cc - p - c)/2 - dp - cd ~ 1
    (2dp + dd - d)/2 + cp - (2cp + cc - c)/2 - dp - cd ~ 1
    (dd - d)/2 + dp + cp - (cc - c)/2 - cp - dp - cd ~ 1
    (dd - d)/2 - (cc - c)/2 - cd ~ 1
    d(d - 1)/2 - c(c - 1)/2 - cd ~ 1
    d(d - 1)/2 + c(c - 1)/2 + cd ~ 1

Beachte, dass hier `p` nicht mehr vorkommt!

Dies ist äquivalent zu:

    (((c ^ d) & 2) >> 1) ^ (c & d & 1) = 1 

bzw.  (TODO Herleitung)

    (c + d) & 2 != 0

---------------------------------

Programmatisch brauchen wir nicht einmal die Grade von `C` und `D` berechnen,
sonder können einfach die Basis-Blade-Bitmaps von `A` und `B` verwenden:
(`^` steht hier für XOR.)

    g := grade(bitmapA ^ bitmapB)  // g === c + d
    if (g && !(g & 2)) throw "bad";

Der Fall `!g` (d.h. `g === 0`) deckt den 1. Fall bzw. die erste obige Summe ab.
Je nach Schleifen-Schachtelung für die Summierung muss dieser Fall gar nicht
explizit getestet werden.

Der Test `g & 2` deckt den 2. Fall und damit die zweite Summe ab.
Wenn `g & 2` truthy ist (d.h., `g(g-1)/2` ist ungerade),
dann ist `AB` (und auch `AB~`) zwar kein Skalar,
aber es gilt `AB~ = -BA~` und damit kürzen sich die Terme `AB~ + BA~` zu 0.


Bedingung nicht notwendig
-------------------------

Der Versor `V := TU` mit Faktoren `T := (ax + by)` und `U := (cz + dw)` ist
normalisierbar:

    VV~
    = (TU)(TU)~
    = (TU)(UT)
    = T(UU)T
    // UU ist als Vektor-Quadrat skalar, kommutiert also mit T:
    = T(T(UU))
    = (TT)(UU)
    // TT ist als Vektor-Quadrat ebenfalls skalar.

Damit ist `VV~` skalar.

Wenn wir jedoch unseren Test auf die ausmultiplizierte Form von `V`

    V = acxz + adxw + bcyz + bdyw

anwenden, schlägt er für die Paare `(acxz, bdyw)` und `(adxw, bcyz)` fehl,
denn `VV~` enthält Komponenten `+2abcdxyzw` vom ersten Paar und `-2abcdxyzw`
vom zweiten, die jeweils nicht-Skalar und nicht-0 sind.  Aber da sich die beiden
(eigentlich: vier) Terme ausgleichen, bleiben (wie bei einem Versor zu erwarten)
nur Skalare übrig.  Hier ist unser Test zu schwach.

Für einen präzisen Test muss man also
- entweder den Ausdruck `VV~` vollständig ausrechnen,
- oder wenigstend die Terme, für die der Test fehlschlägt, aufsammeln
  und sehen, ob sie sich kompensieren (modulo Rundungsfehler),
- oder die Entstehung von `V` mittracken und daher wissen, dass es ein Versor
  ist.

Vermutlich macht letzteres am meisten Sinn.


Nicht-Versoren
--------------

Der Test akzeptiert (korrekterweise) auch bestimmte Nicht-Versoren, z.B.
`M = a + bxyz`.  (Versoren haben einheitliche Grad-Parität!)

IN der Bitmap für `a` ist kein Bit gesetzt und in der Bitmap für `b` sind die
drei Bits für `x`, `y` und `z` gesetzt.  Diese drei Bits sind damit auch in
`bitmapA ^ bitmapB` gesetzt.  Der Grad hiervon ist 3.
Damit akzeptiert der Test den MultiVektor, und zwar zurecht,
denn `MM~` ist skalar:

    MM~
    = (a + bxyz)(a + bxyz)~
    = (a + bxyz)(a - bxyz)
    = aa - abxyz + bxyza - bxyzbxyz
    = aa - abxyz + abxyz + bb
    = aa + bb

Aber hat das einen (geometrischen) Nutzen?
