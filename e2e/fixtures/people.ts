import path from 'node:path';

/** Datos ficticios del e2e: un organizador que participa + 20 invitados, cada quien con 2-3 deseos con foto. */

export type Wish = {
  title: string;
  note: string;
  /** Lo que se escribe en el formulario (a veces sin https://, la app lo completa). */
  url: string;
  /** Lo que debe quedar en el enlace de la tarjeta. */
  expectedHref: string;
  price: number;
  /** Ruta absoluta a la foto real que se sube. */
  image: string;
};

export type Person = { name: string; email: string; phone: string; wishes: Wish[] };

export const IMAGES_DIR = path.join(__dirname, 'images');
export const imageFile = (i: number) => path.join(IMAGES_DIR, `${String(i + 1).padStart(2, '0')}.jpg`);

export const EVENT = {
  name: 'Posada E2E de la familia Flores',
  maxAmountMxn: 500,
  capacity: 30,
  location: 'Casa de la abuela Lupe, Hermosillo',
  description: 'Traigan su taza para el ponche ☕ y algo para el convivio 🌮',
};

const GIFTS: Array<Omit<Wish, 'image' | 'expectedHref'>> = [
  { title: 'Taza navideña de cerámica', note: 'De las grandes, que quepa mucho café', url: 'https://www.amazon.com.mx/s?k=taza+navide%C3%B1a', price: 199 },
  { title: 'Bufanda tejida', note: 'Color vino o gris, nada de brillitos', url: 'https://www.liverpool.com.mx/tienda?s=bufanda', price: 349 },
  { title: 'Libro "Pedro Páramo"', note: 'Edición de bolsillo está perfecto', url: 'www.gandhi.com.mx/catalogsearch/result/?q=pedro+paramo', price: 189 },
  { title: 'Audífonos inalámbricos', note: 'Para el gym, que no se caigan', url: 'https://listado.mercadolibre.com.mx/audifonos-bluetooth-deportivos', price: 480 },
  { title: 'Calcetines navideños', note: 'Talla 7, mientras más feos mejor 🎄', url: 'https://www.amazon.com.mx/s?k=calcetines+navide%C3%B1os', price: 150 },
  { title: 'Juego de mesa "Uno"', note: 'El clásico, el mío ya no tiene todas las cartas', url: 'https://www.liverpool.com.mx/tienda?s=uno+cartas', price: 129 },
  { title: 'Café de Chiapas en grano', note: 'Tueste medio, 500 g', url: 'https://www.amazon.com.mx/s?k=cafe+chiapas+grano', price: 260 },
  { title: 'Planta suculenta con maceta', note: 'Que aguante el sol de Sonora', url: 'https://www.homedepot.com.mx/s/suculenta', price: 180 },
  { title: 'Termo para café', note: 'Que mantenga caliente todo el día', url: 'https://listado.mercadolibre.com.mx/termo-acero-inoxidable', price: 399 },
  { title: 'Cobija de peluche', note: 'Matrimonial, cualquier color menos verde', url: 'https://www.coppel.com/search?q=cobija+matrimonial', price: 450 },
  { title: 'Rompecabezas de 1000 piezas', note: 'Paisajes o mapas', url: 'https://www.amazon.com.mx/s?k=rompecabezas+1000+piezas', price: 320 },
  { title: 'Set de pinceles y acuarelas', note: 'Para empezar a pintar, nada profesional', url: 'https://www.sanborns.com.mx/resultados/q=acuarelas', price: 280 },
  { title: 'Agenda 2027', note: 'Semanal, tamaño carta', url: 'www.officedepot.com.mx/officedepot/en/search/?text=agenda+2027', price: 220 },
  { title: 'Vela aromática', note: 'Olor a canela o vainilla', url: 'https://www.liverpool.com.mx/tienda?s=vela+aromatica', price: 240 },
  { title: 'Gorra de béisbol de los Naranjeros', note: 'Ajustable', url: 'https://listado.mercadolibre.com.mx/gorra-naranjeros-hermosillo', price: 350 },
  { title: 'Kit de salsas picantes', note: 'Entre más pique mejor 🌶️', url: 'https://www.amazon.com.mx/s?k=kit+salsas+picantes', price: 290 },
  { title: 'Cargador portátil', note: '10,000 mAh con USB-C', url: 'https://www.amazon.com.mx/s?k=power+bank+10000', price: 380 },
  { title: 'Libro de cocina mexicana', note: 'Recetas de la abuela, de preferencia', url: 'https://www.gandhi.com.mx/catalogsearch/result/?q=cocina+mexicana', price: 420 },
  { title: 'Pantuflas', note: 'Talla 26, que sean calientitas', url: 'https://www.coppel.com/search?q=pantuflas', price: 260 },
  { title: 'Botella de vino tinto', note: 'Del Valle de Guadalupe si se puede', url: 'https://www.laeuropea.com.mx/catalogsearch/result/?q=valle+de+guadalupe', price: 480 },
  { title: 'Lotería mexicana ilustrada', note: 'Para las posadas que vienen', url: 'https://listado.mercadolibre.com.mx/loteria-mexicana', price: 210 },
  { title: 'Cuaderno de dibujo', note: 'Hojas gruesas, tamaño A4', url: 'https://www.sanborns.com.mx/resultados/q=cuaderno+dibujo', price: 160 },
  { title: 'Bocina bluetooth', note: 'Chiquita, para la regadera', url: 'https://www.amazon.com.mx/s?k=bocina+bluetooth+contra+agua', price: 499 },
  { title: 'Tenis para correr (vale de regalo)', note: 'Mejor un vale, yo escojo la talla', url: 'https://www.innovasport.com/', price: 500 },
  { title: 'Chocolates artesanales de Oaxaca', note: 'Amargos, mínimo 70% cacao', url: 'https://www.amazon.com.mx/s?k=chocolate+oaxaca', price: 230 },
];

const NAMES = [
  'Ana Martínez', 'Beto Ramírez', 'Carla Gómez', 'Daniel Hernández', 'Elena Torres',
  'Fernando López', 'Gaby Sánchez', 'Hugo Castillo', 'Isabel Moreno', 'Jorge Vázquez',
  'Karla Ruiz', 'Luis Mendoza', 'Mariana Ortiz', 'Néstor Aguilar', 'Olivia Flores',
  'Pablo Jiménez', 'Quetzalli Cruz', 'Ricardo Reyes', 'Sofía Morales', 'Tomás Navarro',
];

let imageIndex = 0;
let giftIndex = 0;

function wishes(count: number): Wish[] {
  return Array.from({ length: count }, () => {
    const g = GIFTS[giftIndex++ % GIFTS.length];
    const expectedHref = /^https?:\/\//.test(g.url) ? g.url : `https://${g.url}`;
    return { ...g, expectedHref, image: imageFile(imageIndex++) };
  });
}

export const ORGANIZER: Person = {
  name: 'Héctor Organizador',
  email: 'organizador@posadita.test',
  phone: '662 100 0000',
  wishes: wishes(3),
};

export const PEOPLE: Person[] = NAMES.map((name, i) => ({
  name,
  email: `persona${String(i + 1).padStart(2, '0')}@posadita.test`,
  phone: `662 100 ${String(1001 + i).padStart(4, '0')}`,
  wishes: wishes(2 + (i % 2)),
}));

export const ALL = [ORGANIZER, ...PEOPLE];
export const IMAGE_COUNT = imageIndex;
export const TOTAL_WISHES = ALL.reduce((n, p) => n + p.wishes.length, 0);
