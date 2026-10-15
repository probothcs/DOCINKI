# Docinki Pro: automatyczny wybór góry ściany i kimlaga na dole

Aplikacja dla murarza prefabrykatów. Ze zdjęć rysunków od architekta liczy docinki z bloczka 50×24 warstwa po warstwie, dla całego projektu.
Ta wersja sama dobiera, jak zakończyć górę ściany, żeby było jak najmniej cięcia. Dodaje też start od kimlagi, czyli wodoodpornego bloczka w pierwszej warstwie.

## Dla kogo
Dla murarza i pilarza w hali prefabrykacji. Murują ściany według kartek od architekta i tabel wysokości warstw. Chcą od razu wiedzieć, który wariant wysokości wybrać, żeby ciąć jak najmniej.

## Najważniejsze funkcje i działanie

### 1. Automatyczny wybór zakończenia góry (najmniej cięć)
Aplikacja liczy dla każdej ściany wszystkie możliwe warianty wysokości:
- **Warstwy na wymiar**: warstwy z tabeli dają dokładnie wysokość ściany, bez dodatkowej góry.
- **Cegła na górę**: warstwy + 1 cm zaprawy + cegła 9, 14 albo 19. Cegły 30 cm idą bez docinek, plus 1 zapasowa.
- **Połówka bloczka**: warstwy + 1 cm zaprawy + połówka 50×12. Jedno cięcie bloczka daje dwie połówki.
- **Górna warstwa cięta na wysokość**: warstwy + 1 cm zaprawy + bloczki 50×24 docięte na wysokość, która zostaje (np. 5 cm albo 18 cm). Każdy kawałek tej warstwy jest docinką.

Dla każdego wariantu aplikacja:
- liczy, ile będzie docinek i cięć, razem z docinkami pod wycięciami w rogach
- **wybiera ten z najmniejszą liczbą cięć**, przy remisie najpierw „na wymiar”, potem cegłę
- pokazuje pozostałe warianty jako rząd przycisków, np. „Cegła 14 · 16 cięć”, „Połówka 12 · 22 cięcia”, „Cięta 18 · 30 cięć”

Kliknięcie innego wariantu przelicza ścianę. Wybór zapisuje się razem ze ścianą.
Zestawienie RAZEM w projekcie zbiera cegły, połówki i docinki według wariantów wybranych przy poszczególnych ścianach.

Zastępuje to wcześniejszy ręczny przełącznik „Góra: z cegłą / z bloczka”. Teraz wybór robi aplikacja, a Ty możesz go zmienić.

### 2. Kimlaga na dole (opcja przy ścianie)
- Przy każdej ścianie, na ekranie wymiarów i na liście odczytanych ścian, jest przełącznik „Kimlaga na dole”. Domyślnie jest wyłączony, a domyślne ustawienie można zmienić w Ustawieniach.
- Gdy jest włączony, pierwsza warstwa to kimlaga o wysokości 21 cm. Wyżej idą zwykłe bloczki według tabeli: 21 → ok. 46 → ok. 71 → … (21 + kolejne warstwy z tabeli). Na górze jest wariant wybrany w punkcie 1.
- Kimlaga ma długość 50, jak bloczek, i to samo wiązanie: pierwsza warstwa od pełnego.
  - Docinki w pierwszej warstwie są docinkami z kimlagi. W zestawieniu mają osobny opis: „z kimlagi 50×21”.
- W wyniku jest osobna pozycja „Kimlaga: N pełnych + docinki”.
- Wysokość w wyniku pokazuje się tak: „Kimlaga 21 + 9 × 25,1 + zaprawa 1 + cegła 14 = …”.
- Wysokość kimlagi (21) można zmienić w Ustawieniach.

### 3. Zostaje z poprzedniej poprawki (sprawdzane razem)
- **Docinki pod wycięciami:**
  - wysokość = wysokość wycięcia − dół warstwy − 1 cm zaprawy, zaokrąglone w dół (np. 17×3, 32×16)
  - kawałek mieszczący się w jednym bloczku nie jest dzielony spoiną z warstwy
- **Wiązanie przy wycięciu:**
  - obok wycięcia idzie kawałek wynikający z wiązania (np. 25 − 17 = 8)
  - łączenie i dzielenie na pół za małych kawałków jest tylko na samym końcu ściany
- **Luz:** 1 cm luzu przy każdej docince na długość, wynik zaokrąglony w dół do pełnego cm.
  - Bez luzu i bez zaokrąglania zostają: stała połówka 25 na początku warstwy oraz długości docinek pod wycięciami.
- **Podpisy:** niskie docinki zawsze mają widoczny podpis na rysunku.
- **Bez zmian:**
  - wiele zdjęć z galerii z paskiem postępu
  - cegły 30 cm z 1 zapasową
  - Historia jako projekty z miniaturami
  - zdjęcie rysunku przy ścianie

## Przebieg korzystania
1. Nowa → zdjęcia rysunków → AI odczytuje wymiary i wycięcia.
2. Przy ścianie zaznaczasz „Kimlaga na dole”, jeśli ma być, i poprawiasz wymiary.
3. „Oblicz” → aplikacja wybiera wariant góry z najmniejszą liczbą cięć. Nad rysunkiem widać ten wariant i pozostałe z liczbą cięć.
4. W razie potrzeby wybierasz inny wariant, a wynik od razu się przelicza.
5. Zestawienie RAZEM → „Zapisz projekt”.

## Wygląd i obsługa
Bez zmian w stylu: surowy, kontrastowy, duże przyciski do pracy w rękawicach, pomarańczowe akcenty.
- Warianty góry to poziomy rząd dużych przycisków z liczbą cięć. Wybrany jest ciemny, a najlepszy ma oznaczenie „NAJMNIEJ CIĘĆ”.
- Kimlaga na rysunku ściany ma własny kolor dolnej warstwy.

## Etapy realizacji
**Etap 1 (budowane teraz):**
- liczenie wszystkich wariantów góry (na wymiar, cegła 9/14/19, połówka 12, warstwa cięta na wysokość), automatyczny wybór najmniejszej liczby cięć i ręczna zmiana wariantu
- przełącznik kimlagi przy ścianie (domyślnie wyłączony), wysokość 21, docinki z kimlagi w zestawieniu
- sprawdzenie poprawek z poprzedniej wersji (wycięcia, wiązanie, luz, podpisy)

**Etap 2:**
- kartka dla pilarza (PDF / WhatsApp) z całego projektu
- odhaczanie zrobionych warstw na hali

**Etap 3:**
- zapotrzebowanie materiału na projekt (bloczki, kimlagi, połówki, cegły)
- AI samo rozpoznaje kimlagę z rysunku

## Założenia (przyjęte bez pytania)
- „Liczba cięć” to liczba wszystkich docinek w ścianie: docinki na długość, docinki pod wycięciami, docinki w warstwie ciętej na wysokość oraz połówki (2 połówki = 1 cięcie). Cegły na górę nie są liczone jako cięcia.
- Zwykłe warstwy zawsze mieszczą się w zakresie tabeli 24,4–25,1. Wyjątkiem jest połówka 12: tam warstwa może trochę wyjść poza tabelę, co jest pokazywane jako informacja.
- Warstwa cięta na wysokość jest liczona, gdy zostaje od 3 do 23 cm (po odjęciu 1 cm zaprawy). Dla mniejszej reszty ten wariant się nie pojawia.
- Kimlaga 21 to cała pierwsza warstwa razem ze spoiną. Wyższe warstwy liczą się od 21 według tabeli.
- Kimlaga ma długość 50 cm. Tolerancja długości i luz są takie same jak dla zwykłego bloczka.
- Ściany zapisane wcześniej otwierają się bez kimlagi i z automatycznie wybranym wariantem góry.
