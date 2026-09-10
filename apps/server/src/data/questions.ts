import { QUESTION_DIFFICULTY, type Question } from '@embedded-snakes-live/shared';

const EXPECTED_QUESTION_COUNT = 30;
const EXPECTED_OPTION_COUNT = 4;
const EXPECTED_TIME_LIMIT_SECONDS = 15;

export const questions: Question[] = [
  {
    id: 'q-embedded-001',
    text: '¿Qué característica distingue al software embebido del software de propósito general?',
    category: 'Software embebido',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Siempre necesita conexión a Internet' },
      { id: 'b', text: 'Está fuertemente acoplado al hardware físico' },
      { id: 'c', text: 'Solo puede ejecutarse en computadoras personales' },
      { id: 'd', text: 'No utiliza memoria' },
    ],
  },
  {
    id: 'q-embedded-002',
    text: '¿Cuál de las siguientes es una restricción común en los sistemas embebidos?',
    category: 'Software embebido',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Memoria, energía y capacidad de procesamiento' },
      { id: 'b', text: 'Resolución de pantalla 4K' },
      { id: 'c', text: 'Cantidad de usuarios en redes sociales' },
      { id: 'd', text: 'Capacidad de almacenamiento en la nube' },
    ],
  },
  {
    id: 'q-embedded-003',
    text: '¿Por qué una respuesta tardía puede considerarse un fallo en ciertos sistemas embebidos?',
    category: 'Software embebido',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Porque siempre utilizan Wi-Fi' },
      { id: 'b', text: 'Porque suelen requerir comportamiento en tiempo real' },
      { id: 'c', text: 'Porque no disponen de memoria Flash' },
      { id: 'd', text: 'Porque utilizan únicamente software de escritorio' },
    ],
  },
  {
    id: 'q-embedded-004',
    text: '¿Cuál es uno de los principales objetivos de utilizar una arquitectura en capas?',
    category: 'Arquitectura en capas',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Aumentar el número de microcontroladores' },
      { id: 'b', text: 'Separar responsabilidades e independizar el hardware de la aplicación' },
      { id: 'c', text: 'Eliminar completamente el sistema operativo' },
      { id: 'd', text: 'Guardar toda la lógica dentro del hardware' },
    ],
  },
  {
    id: 'q-embedded-005',
    text: 'Si se cambia un microcontrolador por otro más moderno, ¿qué busca evitar una buena arquitectura en capas?',
    category: 'Arquitectura en capas',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Tener que reescribir toda la lógica de la aplicación' },
      { id: 'b', text: 'Utilizar memoria RAM' },
      { id: 'c', text: 'Instalar sensores externos' },
      { id: 'd', text: 'Ejecutar interrupciones' },
    ],
  },
  {
    id: 'q-embedded-006',
    text: '¿Cuál es el orden correcto de las capas mostradas en la presentación, de nivel superior a nivel inferior?',
    category: 'Arquitectura en capas',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Hardware → HAL → Aplicación → Middleware' },
      { id: 'b', text: 'Aplicación → Middleware/Sistema Operativo → HAL → Hardware' },
      { id: 'c', text: 'HAL → Hardware → Middleware → Aplicación' },
      { id: 'd', text: 'Middleware → Aplicación → Hardware → HAL' },
    ],
  },
  {
    id: 'q-embedded-007',
    text: '¿Qué elementos pueden constituir el “cerebro” del sistema en la capa de hardware?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'MCU o MPU' },
      { id: 'b', text: 'TCP/IP o Bluetooth' },
      { id: 'c', text: 'HAL o HMI' },
      { id: 'd', text: 'FATFS o CAN' },
    ],
  },
  {
    id: 'q-embedded-008',
    text: '¿Dónde residen normalmente los datos volátiles mencionados en la presentación?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'EEPROM' },
      { id: 'b', text: 'Memoria RAM' },
      { id: 'c', text: 'Middleware' },
      { id: 'd', text: 'HAL' },
    ],
  },
  {
    id: 'q-embedded-009',
    text: '¿En qué tipo de memoria puede residir el firmware según la presentación?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Únicamente RAM' },
      { id: 'b', text: 'Flash o EEPROM' },
      { id: 'c', text: 'Solamente memoria caché' },
      { id: 'd', text: 'Registros del ADC' },
    ],
  },
  {
    id: 'q-embedded-010',
    text: '¿Cuál de los siguientes aparece como un periférico integrado del chip?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Temporizador' },
      { id: 'b', text: 'Monitor externo' },
      { id: 'c', text: 'Teclado mecánico' },
      { id: 'd', text: 'Servidor web' },
    ],
  },
  {
    id: 'q-embedded-011',
    text: '¿Qué función realiza un ADC mencionado entre los periféricos integrados?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Es un bus de comunicación' },
      { id: 'b', text: 'Es un conversor análogo-digital' },
      { id: 'c', text: 'Es un sistema operativo' },
      { id: 'd', text: 'Es una memoria no volátil' },
    ],
  },
  {
    id: 'q-embedded-012',
    text: '¿Cuáles de los siguientes aparecen como buses de comunicación en la capa de hardware?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'HTML y CSS' },
      { id: 'b', text: 'I2C y SPI' },
      { id: 'c', text: 'HTTP y FTP' },
      { id: 'd', text: 'FATFS y PWM' },
    ],
  },
  {
    id: 'q-embedded-013',
    text: '¿Cuál de los siguientes pertenece a la electrónica externa?',
    category: 'Hardware',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Sensores y actuadores' },
      { id: 'b', text: 'Algoritmos de negocio' },
      { id: 'c', text: 'Máquina de estados' },
      { id: 'd', text: 'Sistema de archivos FATFS' },
    ],
  },
  {
    id: 'q-embedded-014',
    text: '¿Qué significa HAL?',
    category: 'HAL',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Hardware Application Logic' },
      { id: 'b', text: 'Hardware Abstraction Layer' },
      { id: 'c', text: 'High Architecture Level' },
      { id: 'd', text: 'Hardware Algorithm Language' },
    ],
  },
  {
    id: 'q-embedded-015',
    text: '¿Cuál es la función principal de la HAL?',
    category: 'HAL',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Diseñar físicamente el microcontrolador' },
      { id: 'b', text: 'Actuar como puente y ocultar detalles del hardware a las capas superiores' },
      { id: 'c', text: 'Sustituir completamente a la aplicación' },
      { id: 'd', text: 'Almacenar todas las preguntas del sistema' },
    ],
  },
  {
    id: 'q-embedded-016',
    text: '¿Qué ventaja ofrece la HAL al programador frente a manipular directamente registros hexadecimales?',
    category: 'HAL',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Proporciona funciones legibles y estándar' },
      { id: 'b', text: 'Elimina físicamente los registros' },
      { id: 'c', text: 'Convierte el microcontrolador en un servidor' },
      { id: 'd', text: 'Sustituye la memoria RAM por Flash' },
    ],
  },
  {
    id: 'q-embedded-017',
    text: 'Si por escasez de componentes es necesario cambiar el microcontrolador por uno de otra marca, ¿qué capa debería modificarse principalmente según la presentación?',
    category: 'HAL',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Toda la lógica de aplicación' },
      { id: 'b', text: 'La HAL' },
      { id: 'c', text: 'Todas las interfaces HMI' },
      { id: 'd', text: 'El algoritmo de negocio completo' },
    ],
  },
  {
    id: 'q-embedded-018',
    text: '¿Qué significa RTOS?',
    category: 'RTOS y Middleware',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Real-Time Operating System' },
      { id: 'b', text: 'Runtime Output Storage' },
      { id: 'c', text: 'Remote Transfer Operating Service' },
      { id: 'd', text: 'Real Transfer Output System' },
    ],
  },
  {
    id: 'q-embedded-019',
    text: '¿Cuál es una responsabilidad del RTOS presentada en la exposición?',
    category: 'RTOS y Middleware',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Diseñar sensores físicamente' },
      { id: 'b', text: 'Planificar tareas y gestionar interrupciones' },
      { id: 'c', text: 'Fabricar memoria RAM' },
      { id: 'd', text: 'Sustituir la capa de aplicación' },
    ],
  },
  {
    id: 'q-embedded-020',
    text: '¿Cuál de los siguientes conjuntos corresponde a protocolos implementados por stacks de comunicación?',
    category: 'Middleware',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'TCP/IP, Bluetooth, USB y CAN' },
      { id: 'b', text: 'RAM, Flash, EEPROM y ADC' },
      { id: 'c', text: 'ARM, RISC-V, PWM y HAL' },
      { id: 'd', text: 'HMI, API, RAM y CPU' },
    ],
  },
  {
    id: 'q-embedded-021',
    text: '¿Qué servicio se menciona para manejar almacenamiento persistente mediante un sistema de archivos?',
    category: 'Middleware',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'PWM' },
      { id: 'b', text: 'FATFS' },
      { id: 'c', text: 'ADC' },
      { id: 'd', text: 'HAL' },
    ],
  },
  {
    id: 'q-embedded-022',
    text: '¿Dónde reside el propósito real y final del dispositivo?',
    category: 'Aplicación',
    difficulty: QUESTION_DIFFICULTY.EASY,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'En la capa de Aplicación' },
      { id: 'b', text: 'Únicamente en la memoria RAM' },
      { id: 'c', text: 'En el ADC' },
      { id: 'd', text: 'En los buses I2C' },
    ],
  },
  {
    id: 'q-embedded-023',
    text: '¿Cuál de estos elementos puede formar parte de la capa de Aplicación?',
    category: 'Aplicación',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Máquinas de estados y algoritmos de control' },
      { id: 'b', text: 'Registros físicos del microcontrolador exclusivamente' },
      { id: 'c', text: 'Conversores ADC únicamente' },
      { id: 'd', text: 'Pines eléctricos exclusivamente' },
    ],
  },
  {
    id: 'q-embedded-024',
    text: '¿Qué característica debería tener una buena lógica de aplicación respecto al hardware?',
    category: 'Aplicación',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'c',
    options: [
      { id: 'a', text: 'Contener direcciones de memoria específicas' },
      { id: 'b', text: 'Depender de los números exactos de cada pin' },
      { id: 'c', text: 'Ser agnóstica de detalles específicos como ARM o RISC-V' },
      { id: 'd', text: 'Controlar directamente los voltajes físicos' },
    ],
  },
  {
    id: 'q-embedded-025',
    text: 'Si la aplicación decide “iniciar motor al 50%”, ¿qué parte traduce esa decisión abstracta en una acción física?',
    category: 'Aplicación vs. Hardware',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Hardware/HAL' },
      { id: 'b', text: 'Únicamente la HMI' },
      { id: 'c', text: 'El sistema de archivos' },
      { id: 'd', text: 'La memoria EEPROM' },
    ],
  },
  {
    id: 'q-embedded-026',
    text: 'En el ejemplo donde un usuario presiona un botón físico, ¿qué sucede primero?',
    category: 'Flujo de ejecución',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'La aplicación muestra directamente una pantalla' },
      { id: 'b', text: 'El hardware genera un cambio de voltaje y activa una interrupción' },
      { id: 'c', text: 'FATFS almacena inmediatamente el evento' },
      { id: 'd', text: 'El RTOS cambia el microcontrolador' },
    ],
  },
  {
    id: 'q-embedded-027',
    text: 'En el flujo de ejemplo, ¿qué capa realiza el debouncing y traduce la señal a un evento limpio de software?',
    category: 'Flujo de ejecución',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Aplicación' },
      { id: 'b', text: 'HAL' },
      { id: 'c', text: 'HMI' },
      { id: 'd', text: 'Memoria Flash' },
    ],
  },
  {
    id: 'q-embedded-028',
    text: 'Después de que la HAL genera un evento limpio, ¿qué hace el RTOS en el ejemplo presentado?',
    category: 'Flujo de ejecución',
    difficulty: QUESTION_DIFFICULTY.HARD,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'Fabrica un nuevo periférico' },
      { id: 'b', text: 'Captura el evento, prioriza la tarea crítica y encola un mensaje' },
      { id: 'c', text: 'Borra la memoria Flash' },
      { id: 'd', text: 'Cambia físicamente el procesador' },
    ],
  },
  {
    id: 'q-embedded-029',
    text: '¿Cuál de las siguientes es una ventaja del diseño arquitectónico por capas?',
    category: 'Ventajas y desventajas',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'a',
    options: [
      { id: 'a', text: 'Desarrollo en paralelo y pruebas aisladas' },
      { id: 'b', text: 'Eliminar completamente el uso de RAM' },
      { id: 'c', text: 'Evitar cualquier tipo de latencia' },
      { id: 'd', text: 'Eliminar todos los errores de hardware' },
    ],
  },
  {
    id: 'q-embedded-030',
    text: '¿Cuál es la diferencia principal señalada entre Bare-Metal y RTOS?',
    category: 'Bare-Metal vs RTOS',
    difficulty: QUESTION_DIFFICULTY.MEDIUM,
    timeLimitSeconds: 15,
    correctOptionId: 'b',
    options: [
      {
        id: 'a',
        text: 'Bare-Metal utiliza multitarea preventiva y RTOS solo un while(1)',
      },
      {
        id: 'b',
        text: 'Bare-Metal ejecuta directamente sobre hardware, mientras RTOS permite multitarea basada en prioridades',
      },
      { id: 'c', text: 'Bare-Metal necesita siempre Internet y RTOS no' },
      { id: 'd', text: 'Ambos funcionan exactamente de la misma manera' },
    ],
  },
];

function validateQuestionBank(bank: readonly Question[]): void {
  if (bank.length !== EXPECTED_QUESTION_COUNT) {
    throw new Error(`Expected ${EXPECTED_QUESTION_COUNT} questions, got ${bank.length}.`);
  }

  const ids = new Set<string>();

  for (const question of bank) {
    if (ids.has(question.id)) {
      throw new Error(`Duplicate question id: ${question.id}`);
    }

    ids.add(question.id);

    if (question.timeLimitSeconds !== EXPECTED_TIME_LIMIT_SECONDS) {
      throw new Error(
        `Question ${question.id} must use ${EXPECTED_TIME_LIMIT_SECONDS} seconds.`,
      );
    }

    if (question.options.length !== EXPECTED_OPTION_COUNT) {
      throw new Error(`Question ${question.id} must have ${EXPECTED_OPTION_COUNT} options.`);
    }

    const optionIds = new Set<string>();
    let correctOptionCount = 0;

    for (const option of question.options) {
      if (optionIds.has(option.id)) {
        throw new Error(`Question ${question.id} has duplicate option id: ${option.id}`);
      }

      optionIds.add(option.id);

      if (option.id === question.correctOptionId) {
        correctOptionCount += 1;
      }
    }

    if (correctOptionCount !== 1) {
      throw new Error(`Question ${question.id} must have exactly one correct option.`);
    }
  }
}

validateQuestionBank(questions);
