// demo-data.js — decks de muestra para la demo (contenido original en español).
// Cada tema tiene versiones distintas por nivel escolar, igual que la app real.

const DEMO_SAMPLES = [
  {
    id: "demo-ciclo-agua",
    emoji: "💧",
    thumbBg: "linear-gradient(135deg,#8fd8ef,#0aa3c2)",
    videoTitle: "Cómo funciona el ciclo del agua",
    channel: "Ciencia Divertida",
    length: "12 min",
    videoId: "demo-agua-01",
    defaultTheme: "ocean",
    defaultGrade: "35",
    layout: {
      hero_emoji: "💧",
      subhead: "Por dónde ha pasado cada gota de lluvia",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "steps", size: "lg", emoji: "🔁", title: "El recorrido" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "lg", emoji: "🤯", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "El agua da vueltas",
        substance: {
          big_idea: "El agua sube al cielo y vuelve a bajar. ¡Y lo hace una y otra vez!",
          hook: "¡La lluvia de hoy lleva muchísimos años cayendo!",
          key_points: [
            { title: "Sube", detail: "El sol calienta el agua. El agua flota." },
            { title: "Nubes", detail: "Arriba, el agua hace nubes." },
            { title: "Baja", detail: "Las nubes se llenan. ¡Cae la lluvia!" },
          ],
          steps: [
            { title: "Calor", detail: "El sol calienta el agua." },
            { title: "Sube", detail: "El agua flota muy alto." },
            { title: "Lluvia", detail: "El agua vuelve a caer." },
          ],
          numbers: [{ value: "Casi toda", meaning: "el agua de la Tierra está en el mar" }],
          vocab: [{ word: "nube", kid_definition: "muchas gotitas de agua juntas y esponjosas" }],
          fun_fact: "¡Esta misma agua ya existía cuando había dinosaurios!",
          takeaway: "Cuando llueva, piensa: el agua solo va de regreso a empezar otra vez.",
          quiz: [
            { q: "¿Qué hace que el agua suba?", a: "¡El calorcito del sol!" },
            { q: "¿Qué cae de las nubes?", a: "¡La lluvia!" },
          ],
        },
      },
      "35": {
        title: "El increíble viaje del agua",
        substance: {
          big_idea: "El agua viaja en un círculo sin fin entre el mar, el cielo y la tierra.",
          hook: "¡El agua que tomaste hoy pudo haber estado en el charco de un dinosaurio!",
          key_points: [
            { title: "Evaporación", detail: "El sol calienta el agua y la convierte en vapor invisible que sube." },
            { title: "Condensación", detail: "Con el frío de arriba, el vapor se vuelve gotitas que forman nubes." },
            { title: "Precipitación", detail: "Cuando las nubes pesan mucho, el agua cae como lluvia, nieve o granizo." },
          ],
          steps: [
            { title: "Se calienta", detail: "El sol calienta lagos, ríos y mares." },
            { title: "Sube", detail: "El vapor de agua flota hacia el cielo." },
            { title: "Cae", detail: "La lluvia regresa el agua a la tierra." },
          ],
          numbers: [{ value: "97%", meaning: "del agua de la Tierra está en los océanos" }],
          vocab: [
            { word: "vapor", kid_definition: "agua convertida en gas invisible" },
            { word: "condensar", kid_definition: "cuando un gas se enfría y vuelve a ser líquido" },
          ],
          fun_fact: "La Tierra lleva miles de millones de años reciclando exactamente la misma agua.",
          takeaway: "La próxima vez que llueva, recuerda que esa agua viene de un viaje increíble.",
          quiz: [
            { q: "¿Qué hace que el agua suba al cielo?", a: "El calor del sol — la evaporación." },
            { q: "¿De qué están hechas las nubes?", a: "De gotitas de vapor condensado." },
          ],
        },
      },
      "68": {
        title: "El ciclo del agua, explicado",
        substance: {
          big_idea: "Impulsada por la energía del Sol, el agua se mueve continuamente entre océanos, atmósfera y tierra en un sistema cerrado.",
          hook: "No existe agua 'nueva': el planeta reutiliza la misma desde hace eones.",
          key_points: [
            { title: "Evaporación y transpiración", detail: "La energía solar convierte el agua en vapor; las plantas también liberan vapor por sus hojas." },
            { title: "Condensación", detail: "El vapor sube, se enfría y se agrupa alrededor de partículas diminutas para formar nubes." },
            { title: "Precipitación y colección", detail: "El agua regresa como lluvia o nieve, corre por los ríos y se filtra al subsuelo." },
          ],
          steps: [
            { title: "Evaporación", detail: "La energía del Sol eleva el agua como vapor." },
            { title: "Condensación", detail: "El aire frío de las alturas forma nubes." },
            { title: "Precipitación", detail: "El agua cae, se acumula y el ciclo vuelve a empezar." },
          ],
          numbers: [
            { value: "97%", meaning: "del agua de la Tierra es agua salada de los océanos" },
            { value: "~9 días", meaning: "tiempo promedio que una molécula de agua pasa en el aire" },
          ],
          vocab: [
            { word: "transpiración", kid_definition: "cuando las plantas liberan vapor de agua por sus hojas" },
            { word: "agua subterránea", kid_definition: "agua guardada bajo tierra, entre el suelo y las rocas" },
          ],
          fun_fact: "Una sola molécula de agua puede pasar miles de años en el fondo del océano antes de evaporarse.",
          takeaway: "El ciclo del agua es un sistema cerrado: la energía cambia su forma, pero nunca la crea ni la destruye.",
          quiz: [
            { q: "¿Qué dos procesos mandan agua al aire?", a: "La evaporación y la transpiración." },
            { q: "¿Por qué se dice que es un 'sistema cerrado'?", a: "Porque la cantidad total de agua no cambia — solo cambia de forma." },
          ],
        },
      },
      "912": {
        title: "Ciclo hidrológico y energía",
        substance: {
          big_idea: "El ciclo hidrológico redistribuye agua y calor latente por los sistemas de la Tierra, impulsado por la radiación solar y la gravedad.",
          hook: "Cada cambio de fase mueve cantidades enormes de energía: es un motor clave del clima.",
          key_points: [
            { title: "Los cambios de fase mueven energía", detail: "La evaporación absorbe calor latente; la condensación lo libera, alimentando tormentas y regulando la temperatura." },
            { title: "Varios reservorios", detail: "El agua se almacena en océanos, hielo, acuíferos y atmósfera, cada uno con tiempos de residencia muy distintos." },
            { title: "Impacto humano", detail: "El uso del suelo, las presas y el calentamiento cambian dónde y qué tan rápido se mueve el agua." },
          ],
          steps: [
            { title: "Evaporación", detail: "La energía solar convierte agua líquida en vapor, almacenando calor latente." },
            { title: "Condensación", detail: "El enfriamiento libera ese calor y forma nubes." },
            { title: "Precipitación y escurrimiento", detail: "La gravedad regresa el agua a la superficie, hacia ríos y acuíferos." },
          ],
          numbers: [
            { value: "97.5%", meaning: "del agua de la Tierra es salada" },
            { value: "~2.5%", meaning: "es dulce, y casi toda está congelada" },
          ],
          vocab: [
            { word: "calor latente", kid_definition: "energía que se guarda o se libera cuando el agua cambia de estado" },
            { word: "tiempo de residencia", kid_definition: "cuánto permanece el agua, en promedio, en un mismo reservorio" },
          ],
          fun_fact: "El calor latente que libera la condensación es una fuente principal de energía de los huracanes.",
          takeaway: "El ciclo no es solo agua: es un motor gigante de energía que da forma al clima global.",
          quiz: [
            { q: "¿Qué papel juega el calor latente en el clima?", a: "Al liberarse durante la condensación, aporta la energía que alimenta las tormentas." },
            { q: "¿Dónde está la mayor parte del agua dulce?", a: "En glaciares y casquetes de hielo." },
          ],
        },
      },
    },
  },

  {
    id: "demo-chocolate",
    emoji: "🍫",
    thumbBg: "linear-gradient(135deg,#d3f26a,#2e8b57)",
    videoTitle: "El chocolate: regalo de Mesoamérica",
    channel: "Historia para Todos",
    length: "15 min",
    videoId: "demo-choco-01",
    defaultTheme: "jungle",
    defaultGrade: "35",
    layout: {
      hero_emoji: "🍫",
      subhead: "De la semilla de cacao a tu taza",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "Lo esencial" },
        { type: "numbers", size: "md", emoji: "🔢", title: "" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "lg", emoji: "🤯", title: "" },
        { type: "quiz", size: "lg", emoji: "❓", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "El chocolate viene de un árbol",
        substance: {
          big_idea: "El chocolate empieza como semillas de un árbol llamado cacao.",
          hook: "¿Sabías que tu chocolate creció en un árbol de la selva?",
          key_points: [
            { title: "Un árbol", detail: "El cacao crece en lugares calientes." },
            { title: "Semillas", detail: "Adentro de su fruta hay semillas." },
            { title: "A cocinar", detail: "Las semillas se tuestan y se muelen. ¡Sale chocolate!" },
          ],
          steps: [],
          numbers: [{ value: "Muchas", meaning: "semillas caben en una fruta de cacao" }],
          vocab: [{ word: "cacao", kid_definition: "el árbol y la semilla de donde sale el chocolate" }],
          fun_fact: "Hace mucho tiempo, aquí en estas tierras, ¡las semillas de cacao se usaban como dinero!",
          takeaway: "Tu chocolate favorito empezó siendo una semillita en la selva.",
          quiz: [
            { q: "¿De dónde viene el chocolate?", a: "¡De las semillas del árbol de cacao!" },
            { q: "¿Dónde crece el cacao?", a: "En lugares calientes, como la selva." },
          ],
        },
      },
      "35": {
        title: "El chocolate: regalo de Mesoamérica",
        substance: {
          big_idea: "El chocolate nació en Mesoamérica: los pueblos mayas y mexicas lo preparaban mucho antes de que lo conociera el resto del mundo.",
          hook: "El chocolate que te encanta se inventó aquí cerca, ¡hace miles de años!",
          key_points: [
            { title: "Nace en la selva", detail: "El árbol de cacao crece en zonas cálidas y húmedas, como el sur de México y Centroamérica." },
            { title: "Bebida especial", detail: "Los mayas y los mexicas lo tomaban como una bebida espumosa, a veces con chile, no como dulce." },
            { title: "De semilla a barra", detail: "Las semillas se fermentan, se secan, se tuestan y se muelen para hacer el chocolate." },
          ],
          steps: [],
          numbers: [
            { value: "3,000+", meaning: "años tiene la historia del cacao en Mesoamérica" },
            { value: "30–40", meaning: "semillas trae una mazorca de cacao" },
          ],
          vocab: [
            { word: "cacao", kid_definition: "el árbol y la semilla con la que se hace el chocolate" },
            { word: "Mesoamérica", kid_definition: "la región histórica que incluye gran parte de México y Centroamérica" },
          ],
          fun_fact: "Para los mexicas, las semillas de cacao eran tan valiosas que servían como moneda.",
          takeaway: "Cada vez que pruebes chocolate, estás probando un invento mesoamericano con miles de años de historia.",
          quiz: [
            { q: "¿Quiénes preparaban chocolate primero?", a: "Los pueblos de Mesoamérica, como mayas y mexicas." },
            { q: "¿Cómo lo tomaban?", a: "Como bebida espumosa, a veces con chile." },
          ],
        },
      },
      "68": {
        title: "Cacao: historia y ciencia",
        substance: {
          big_idea: "El cacao pasó de moneda y bebida ceremonial en Mesoamérica a uno de los cultivos más importantes del mundo.",
          hook: "Pocas plantas han cambiado tanto la historia — y la economía — como el cacao.",
          key_points: [
            { title: "Origen mesoamericano", detail: "Mayas y mexicas domesticaron el cacao; era bebida de élite, ofrenda y moneda de cambio." },
            { title: "Proceso en cadena", detail: "Fermentación, secado, tostado y molienda transforman una semilla amarga en chocolate." },
            { title: "Cultivo delicado", detail: "El cacao solo prospera en franjas tropicales húmedas, lo que concentra su producción en pocos países." },
          ],
          steps: [],
          numbers: [
            { value: "3,000+", meaning: "años de historia documentada del cacao" },
            { value: "20°", meaning: "grados alrededor del ecuador: la franja donde crece" },
          ],
          vocab: [
            { word: "fermentación", kid_definition: "proceso natural que desarrolla el sabor de la semilla" },
            { word: "domesticar", kid_definition: "cultivar y mejorar una planta silvestre a lo largo de generaciones" },
          ],
          fun_fact: "La palabra 'chocolate' viene del náhuatl, la lengua de los mexicas.",
          takeaway: "El chocolate es química, agricultura e historia mesoamericana en una sola mordida.",
          quiz: [
            { q: "¿Qué usos tenía el cacao en Mesoamérica?", a: "Bebida ceremonial, ofrenda y moneda." },
            { q: "¿Qué proceso desarrolla el sabor de la semilla?", a: "La fermentación (y luego el tostado)." },
          ],
        },
      },
      "912": {
        title: "Cacao: de moneda a industria global",
        substance: {
          big_idea: "El cacao ilustra cómo un cultivo mesoamericano se volvió una cadena de valor global, con historia, química y economía entrelazadas.",
          hook: "Detrás de cada barra hay 3,000 años de historia y una cadena de producción que cruza continentes.",
          key_points: [
            { title: "Del ritual al comercio", detail: "En Mesoamérica el cacao tenía valor ceremonial y monetario; con la colonización se volvió mercancía global." },
            { title: "Química del sabor", detail: "La fermentación y el tostado generan cientos de compuestos que definen el aroma del chocolate." },
            { title: "Economía concentrada", detail: "Hoy la mayor parte del cacao se cultiva en África Occidental, mientras el consumo se concentra en países ricos — una cadena de valor desigual." },
          ],
          steps: [],
          numbers: [
            { value: "3,000+", meaning: "años desde los primeros usos registrados en Mesoamérica" },
            { value: "~60%", meaning: "del cacao mundial sale de África Occidental" },
          ],
          vocab: [
            { word: "cadena de valor", kid_definition: "todos los pasos y actores entre la semilla y el producto final" },
            { word: "mercancía (commodity)", kid_definition: "producto básico que se comercia a gran escala en mercados globales" },
          ],
          fun_fact: "Las palabras 'cacao' y 'chocolate' llegaron a casi todos los idiomas del mundo desde lenguas mesoamericanas.",
          takeaway: "El cacao muestra cómo la historia local puede convertirse en economía global — con beneficios y desigualdades que aún se discuten.",
          quiz: [
            { q: "¿Cómo cambió el rol del cacao tras la colonización?", a: "Pasó de bien ceremonial y moneda local a mercancía de comercio global." },
            { q: "¿Dónde se cultiva hoy la mayor parte del cacao?", a: "En África Occidental." },
          ],
        },
      },
    },
  },

  {
    id: "demo-interes",
    emoji: "💰",
    thumbBg: "linear-gradient(135deg,#ffd166,#ff7ab8)",
    videoTitle: "Interés compuesto para principiantes",
    channel: "Finanzas en Corto",
    length: "18 min",
    videoId: "demo-dinero-01",
    defaultTheme: "candy",
    defaultGrade: "68",
    layout: {
      hero_emoji: "💰",
      subhead: "Cómo el dinero puede hacer crecer más dinero",
      cards: [
        { type: "big_idea", size: "xl", emoji: "💡", title: "" },
        { type: "points", size: "lg", emoji: "🔑", title: "Las ideas clave" },
        { type: "numbers", size: "lg", emoji: "📈", title: "Míralo crecer" },
        { type: "vocab", size: "md", emoji: "📚", title: "" },
        { type: "fun_fact", size: "md", emoji: "🤯", title: "" },
        { type: "takeaway", size: "lg", emoji: "🎒", title: "" },
      ],
    },
    grades: {
      k2: {
        title: "El dinero que crece",
        substance: {
          big_idea: "Si guardas un poquito de dinero, con el tiempo puede volverse más dinero.",
          hook: "¡Imagina una alcancía que agrega monedas solita!",
          key_points: [
            { title: "Guárdalo", detail: "Aparta un poquito. No lo gastes." },
            { title: "Espera", detail: "Mientras más esperas, más crece." },
            { title: "Se junta", detail: "Los ahorros chiquitos se hacen grandes." },
          ],
          steps: [],
          numbers: [{ value: "$1 → $2", meaning: "el dinero puede crecer si esperas" }],
          vocab: [{ word: "ahorrar", kid_definition: "guardar dinero en vez de gastarlo" }],
          fun_fact: "¡Esperar es como un superpoder para el dinero!",
          takeaway: "Guarda un poquito, espera mucho, y míralo crecer.",
          quiz: [
            { q: "¿Qué hay que hacer para que el dinero crezca?", a: "¡Guardarlo y esperar!" },
            { q: "¿Crece más si esperas más tiempo?", a: "¡Sí!" },
          ],
        },
      },
      "35": {
        title: "La bola de nieve del dinero",
        substance: {
          big_idea: "Cuando ahorras, tu dinero puede ganar un extra — y luego ese extra también gana. ¡Crece como bola de nieve!",
          hook: "Tu dinero puede trabajar y ganar más dinero mientras tú duermes.",
          key_points: [
            { title: "El interés es un premio", detail: "El banco te da un poquito extra por guardar tu dinero ahí." },
            { title: "Crece sobre sí mismo", detail: "La próxima vez ganas extra sobre tu dinero Y sobre el extra de antes." },
            { title: "El tiempo es el secreto", detail: "Mientras más tiempo lo dejes, más grande se hace la bola de nieve." },
          ],
          steps: [],
          numbers: [
            { value: "$100", meaning: "pesos con los que empiezas" },
            { value: "$110", meaning: "después de un año ganando un extra" },
          ],
          vocab: [{ word: "interés", kid_definition: "dinero extra que ganas por ahorrar" }],
          fun_fact: "Empezar a ahorrar de chico gana casi siempre a ahorrar mucho pero tarde.",
          takeaway: "Ahorra temprano y ten paciencia — el tiempo hace el trabajo pesado.",
          quiz: [
            { q: "¿Qué es el interés?", a: "Dinero extra que ganas por ahorrar." },
            { q: "¿Qué hace más grande la bola de nieve?", a: "El tiempo — mientras más esperas, más crece." },
          ],
        },
      },
      "68": {
        title: "Por qué gana quien ahorra temprano",
        substance: {
          big_idea: "El interés compuesto significa ganar interés sobre tu dinero original Y sobre el interés que ya ganaste, así que los ahorros crecen cada vez más rápido.",
          hook: "Dos amigos ahorran lo mismo en total — pero el que empezó antes termina con mucho más. Aquí está el porqué.",
          key_points: [
            { title: "Interés sobre interés", detail: "A diferencia del interés simple, el compuesto te paga sobre el saldo que va creciendo, no solo sobre tu primer depósito." },
            { title: "El tiempo le gana al monto", detail: "Empezar unos años antes suele importar más que depositar cantidades grandes después." },
            { title: "La regla del 72", detail: "Divide 72 entre la tasa de interés para estimar en cuántos años se duplica tu dinero." },
          ],
          steps: [],
          numbers: [
            { value: "$1,000", meaning: "pesos iniciales" },
            { value: "$2,000", meaning: "tras ~9 años al 8% — se duplicó" },
            { value: "$4,000", meaning: "tras ~18 años — se volvió a duplicar" },
          ],
          vocab: [
            { word: "interés compuesto", kid_definition: "interés ganado sobre tu dinero y también sobre tus intereses anteriores" },
            { word: "capital", kid_definition: "la cantidad original de dinero que depositaste" },
          ],
          fun_fact: "Por el efecto compuesto, gran parte del crecimiento llega en los últimos años — la curva se empina.",
          takeaway: "Empieza a ahorrar lo antes posible: el tiempo es el mejor amigo del interés compuesto.",
          quiz: [
            { q: "¿En qué se diferencia el interés compuesto del simple?", a: "Te paga también sobre los intereses, no solo sobre el depósito original." },
            { q: "¿Qué estima la regla del 72?", a: "En cuántos años se duplica tu dinero." },
          ],
        },
      },
      "912": {
        title: "Interés compuesto y valor del dinero en el tiempo",
        substance: {
          big_idea: "El crecimiento compuesto es exponencial: los rendimientos reinvertidos generan sus propios rendimientos, por eso el horizonte de tiempo es la palanca más poderosa de las finanzas personales.",
          hook: "Empezar a invertir a los 22 en vez de a los 32 puede significar una diferencia enorme — con la misma aportación mensual.",
          key_points: [
            { title: "Exponencial, no lineal", detail: "El saldo sigue A = P(1 + r/n)^(nt); el crecimiento se acelera conforme la base se compone." },
            { title: "El costo de esperar", detail: "Cada año que retrasas elimina el periodo de composición más valioso: el último, cuando el saldo es mayor." },
            { title: "Las comisiones también se componen", detail: "Una comisión anual del 1% se compone en tu contra y erosiona décadas de rendimiento." },
          ],
          steps: [],
          numbers: [
            { value: "8%", meaning: "rendimiento anual de ejemplo" },
            { value: "~9 años", meaning: "tiempo de duplicación al 8% (regla del 72)" },
            { value: "10x", meaning: "aprox. cuánto crece $1 en 30 años al 8%" },
          ],
          vocab: [
            { word: "valor del dinero en el tiempo", kid_definition: "la idea de que el dinero de hoy vale más que el mismo dinero mañana" },
            { word: "rendimiento anual", kid_definition: "el porcentaje que crece tu inversión en un año" },
          ],
          fun_fact: "Bajar las comisiones del 1% al 0.1% puede dejarte con decenas de puntos porcentuales más de patrimonio en una carrera, solo por evitar el arrastre compuesto.",
          takeaway: "Maximiza tu tiempo en el mercado y minimiza las comisiones: ambas cosas se componen dramáticamente en décadas.",
          quiz: [
            { q: "¿Por qué es tan costoso retrasar la inversión?", a: "Pierdes los últimos años de composición, los más poderosos, cuando el saldo es mayor." },
            { q: "¿Cómo dañan las comisiones el rendimiento a largo plazo?", a: "Se componen en tu contra cada año y erosionan gran parte del crecimiento." },
          ],
        },
      },
    },
  },
];
