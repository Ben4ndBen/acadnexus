const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const studentsData = [
  // IMAGE 1
  { id: "2023-1140-AB", last: "Abad", first: "Siena Marie", middle: "NONE", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2026-3189-AB", last: "Acebes", first: "Benedict John", middle: "Hostallero", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2025-3014-AB", last: "Alariao", first: "John Martin", middle: "Ponce", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2026-3175-AB", last: "Alariao", first: "Florenz Jay", middle: "Ponce", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1232-AB", last: "Alcantara", first: "Josue", middle: "None", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2023-1243-AB", last: "Alcantara", first: "Marivic", middle: "Arca", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2024-1087-AB", last: "Alcazar", first: "Angela", middle: "Asa", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-1309-AB", last: "Alcon", first: "Alianny Alexa", middle: "Bata", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2023-1141-AB", last: "Alcoy", first: "Joseph Marie", middle: "Meonada", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2026-3114-AB", last: "Alueta", first: "Princess", middle: "Hubalde", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2025-1389-AB", last: "Amboy", first: "Gladwin Dave", middle: "Balles", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3037-AE", last: "Arnado", first: "Jonalyn", middle: "Prado", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2026-3045-AE", last: "Asa", first: "Fritzi Paul", middle: "Salamagos", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2023-1022-AB", last: "Balderas", first: "Mariz", middle: "Arca", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2025-1369-AB", last: "Baliday", first: "Katrice Glaiza", middle: "Nipaya", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2026-3147-AB", last: "Ballado", first: "Jhon Philip", middle: "Servillon", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2023-1143-AB", last: "Balles", first: "John Wayne", middle: "Makinano", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2024-1140-AB", last: "Barcelona", first: "Daniel", middle: "None", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2025-1376-AB", last: "Bayonito", first: "Jomarie", middle: "None", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1096-AB", last: "Binalon", first: "Melody", middle: "Horcajo", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2023-1187-AB", last: "Bohol", first: "Glen", middle: "Lombres", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2025-2010-AB", last: "Brillo", first: "Shena", middle: "Diocton", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2023-1144-AB", last: "Brillo", first: "Paul Joshua", middle: "Diocton", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2024-1043-AB", last: "Bunod", first: "Salonica", middle: "Manera", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-1360-AB", last: "Cabaltera", first: "Arabelle", middle: "Acaya", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1190-AB", last: "Cabilin", first: "Dexter", middle: "Valiente", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3122-AB", last: "Cabizon", first: "Shekeniah", middle: "Alcazar", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2023-1029-AB", last: "Cabrera", first: "Vina Marie", middle: "Agresor", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2026-3146-AB", last: "Cabugao", first: "Maria Angelica", middle: "None", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2024-1217-AB", last: "Cabugao", first: "Peter Kim", middle: "Escalona", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2025-1387-AB", last: "Cacayan", first: "Rissa Mae", middle: "Ratera", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1039-AB", last: "Calma", first: "Lyra", middle: "Alcoy", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2026-3113-AB", last: "Camaya", first: "Angelica Lyka", middle: "None", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2026-3057-AE", last: "Cantero", first: "Maria Shatherine", middle: "Galolo", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2023-1147-AB", last: "Cardona", first: "John Ryan", middle: "Horiondo", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2023-1011-AB", last: "Cariaso", first: "Paul Benedict", middle: "Hornedo", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2025-1342-AB", last: "Carzon", first: "Sharlene", middle: "Cariaso", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1078-AB", last: "Carzon", first: "Carmie Denise", middle: "Enego", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2024-1093-AB", last: "Castaño", first: "Eiren Luxiel", middle: "Areola", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-3020-AE", last: "Castillejos", first: "Mark Anthony", middle: "Viola", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2024-1240-AB", last: "Castillo", first: "Maria Nicole", middle: "Eriful", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2019-1170-AB", last: "Castillo", first: "Michael", middle: "Mina", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3164-AB", last: "Castro", first: "Monica", middle: "Roniño", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2024-1237-AB", last: "Catabay", first: "Rheany", middle: "Quitola", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2026-3092-AE", last: "Cataluña", first: "Marjhon", middle: "Cabas", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2025-1292-AB", last: "Comision", first: "Julie Jane", middle: "Padilla", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2023-1055-AB", last: "Cultura", first: "Kryza Anne", middle: "Gaza", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2025-1405-AB", last: "Danila", first: "Wilbert Paul", middle: "Aguas", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1076-AB", last: "Daroca", first: "Rhobie Gayle", middle: "Castillo", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2023-1150-AB", last: "Daroca", first: "Yaniley Rhobie", middle: "Castillo", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2023-1059-AB", last: "De Guzman", first: "Sheena Rose", middle: "Manzo", gender: "Female", program: "BS Info Tech", year: 4 },

  // IMAGE 2
  { id: "2024-1082-AB", last: "Dela Cruz", first: "Alfred John", middle: "Alavado", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3139-AB", last: "Delatado", first: "Joshiane", middle: "Intervalo", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2026-3199-AB", last: "Domingo", first: "Mamico", middle: "Padduyao", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2023-1151-AB", last: "Ebalin", first: "Carlo", middle: "Tubice", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2024-1011-AB", last: "Elcano", first: "Zack", middle: "Hortiz", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2023-1152-AB", last: "Elento", first: "Rachel", middle: "Ballada", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2024-1172-AB", last: "Elica", first: "Jan Raven", middle: "Hortiz", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3056-AE", last: "Elvinia", first: "Janela", middle: "Derecho", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2026-3034-AE", last: "Escobido", first: "Camille", middle: "Pajudpud", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2023-1018-AB", last: "Espera", first: "James Kelly", middle: "Ebina", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2023-1153-AB", last: "Evina", first: "Stephen", middle: "Doniapon", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2026-3053-AE", last: "Fernandez", first: "Gerald", middle: "Agabin", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2026-3149-AB", last: "Fidel", first: "Shyloh Adine", middle: "None", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2023-1154-AB", last: "Gabas", first: "Marx Nathaniel", middle: "None", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2024-1129-AB", last: "Gabotero", first: "Joland", middle: "Haro", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3148-AB", last: "Gamboa", first: "Icyer", middle: "None", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2024-1243-AB", last: "Garcia", first: "John Maverick", middle: "Diente", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2025-1329-AB", last: "Gato", first: "Vanessa", middle: "Villena", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1138-AB", last: "Gonzales", first: "Jacob", middle: "Caddarrao", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1263-AB", last: "Gordo", first: "Lloyd William", middle: "Valiente", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1026-AB", last: "Gordo", first: "Jess Christopher", middle: "Gulaga", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1091-AB", last: "Graiz", first: "Joshua", middle: "Atunay", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2022-1017-AB", last: "Guerrero", first: "John Paul", middle: "Ballada", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1071-AB", last: "Guisando", first: "Charles Mikko", middle: "None", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1069-AB", last: "Gulaga", first: "Mark Patrick", middle: "Velayo", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1204-AB", last: "Gulaga", first: "Mike Jave", middle: "Salamagos", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2025-1354-AB", last: "Habana", first: "Camille", middle: "Beronque", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1086-AB", last: "Heruela", first: "Jamela Aisha", middle: "Castro", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2024-1084-AB", last: "Honesta", first: "Seigfrid", middle: "Falces", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1144-AB", last: "Horiondo", first: "Joel Jr.", middle: "Valiente", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2019-1233-AB", last: "Hostallero", first: "Lynette Mae", middle: "Adami", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1152-AB", last: "Hubalde", first: "Gaspar Jr.", middle: "Hoyos", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1280-AB", last: "Intervalo", first: "Luis Dominic", middle: "Alcazar", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2025-3011-AB", last: "Javier", first: "Denver Russell", middle: "Ceballos", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2025-3002-AE", last: "Juralbal", first: "Malex", middle: "Duerme", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1101-AB", last: "Lagundino", first: "Jacob Clancy", middle: "Batiforra", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1189-AB", last: "Lampas", first: "Lexter", middle: "Labrador", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1214-AB", last: "Lavengco", first: "Carlito", middle: "Velaño", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1088-AB", last: "Librero", first: "Maria Karyle", middle: "Eriful", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2023-1157-AB", last: "Librero", first: "John", middle: "Eriful", gender: "Male", program: "BS Info Tech", year: 4 },
  { id: "2024-1012-AB", last: "Manana", first: "Sam Silver", middle: "Ugaddan", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2025-1374-AB", last: "Manzo", first: "John Jezreel", middle: "De La Torre", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3138-AB", last: "Mata", first: "Jhana Steff", middle: "Acebes", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2025-1335-AB", last: "Mata", first: "Hareitte Mae", middle: "Zureta", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2026-3107-AB", last: "Meman", first: "Janelle", middle: "Baletin", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2024-1136-AB", last: "Mergal", first: "Lyca", middle: "Niño", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-1340-AB", last: "Merin", first: "Francine Kae", middle: "Cabugao", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1222-AB", last: "Merina", first: "Dholian", middle: "Intervalo", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2020-1005-AB", last: "Mina", first: "Jenefer", middle: "Gonzales", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2024-1171-AB", last: "Moro", first: "Aramae", middle: "Quinto", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-1349-AB", last: "Nico", first: "Clint Adrian", middle: "Salengua", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3173-AB", last: "Nicolas", first: "Mark Wilben", middle: "Cruz", gender: "Male", program: "BS Info Tech", year: 1 },

  // IMAGE 3
  { id: "2026-3174-AB", last: "Nicolas", first: "Ariana Caxiopeia", middle: "Cruz", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2024-1153-AB", last: "Niño", first: "John Ivan", middle: "Cabugao", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1085-AB", last: "Noblejas", first: "Dominick", middle: "Apresto", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3165-AB", last: "Nola", first: "John Amiel", middle: "Castillo", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2021-2014-AB", last: "Nola", first: "Gloria Beth", middle: "Alcantara", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2024-1212-AB", last: "Noleal", first: "Karen", middle: "Cultura", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2025-1372-AB", last: "Ortiz", first: "Dominic Excel", middle: "Comaya", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3196-AB", last: "Pajudpud", first: "Ma. Alliyah", middle: "None", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2026-3124-AB", last: "Pama", first: "Niel Axel", middle: "Mayor", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2024-1116-AB", last: "Paradeza", first: "Matt Benmar", middle: "Valdesancho", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2025-1337-AB", last: "Pedronan", first: "Justine", middle: "Dela Cruz", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2024-1089-AB", last: "Perez", first: "John Lee", middle: "Feliciano", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3169-AB", last: "Pimentel", first: "Neil Gabriel", middle: "Nuñez", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2026-3072-AE", last: "Ponce", first: "Gian Steve", middle: "None", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2025-1415-AB", last: "Poncio", first: "Khanley", middle: "None", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2024-1193-AB", last: "Reyes", first: "Cherylee", middle: "Libaton", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1254-AB", last: "Roniño", first: "Maria Regene", middle: "Gulaga", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2025-1368-AB", last: "Salamagos", first: "Tracy Nicole", middle: "None", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1154-AB", last: "Salengua", first: "Jared", middle: "Navarro", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1020-AB", last: "Simon", first: "Mark", middle: "Dican", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1203-AB", last: "Sotto", first: "Teresa Jane", middle: "Umayam", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2024-1206-AB", last: "Tabuso", first: "Pio Luis", middle: "Salengua", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2024-1253-AB", last: "Tabuso", first: "John David", middle: "None", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2026-3070-AE", last: "Tolentino", first: "Aldrin Paul", middle: "Cabrito", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2026-3130-AB", last: "Trinidad", first: "Davin Adriel", middle: "Hordoñez", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2024-1108-AB", last: "Valiente", first: "Adrian Louie", middle: "None", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3106-AB", last: "Vargas", first: "Ella Mae", middle: "Servillon", gender: "Female", program: "BS Info Tech", year: 1 },
  { id: "2024-1074-AB", last: "Vargas", first: "Jacob Keegan", middle: "Visaya", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2025-1290-AB", last: "Verana", first: "Jan Dominic", middle: "Abas", gender: "Male", program: "BS Info Tech", year: 2 },
  { id: "2023-1227-AB", last: "Verzon", first: "Aiza", middle: "Laderas", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2024-1075-AB", last: "Villacruzada", first: "Anthony", middle: "Danila", gender: "Male", program: "BS Info Tech", year: 3 },
  { id: "2026-3089-AE", last: "Villacruzada", first: "Thomas", middle: "Danila", gender: "Male", program: "BS Info Tech", year: 1 },
  { id: "2024-1068-AB", last: "Villarta", first: "Roxie Mae", middle: "Bongay", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1164-AB", last: "Villegas", first: "Rachelle Anne", middle: "Marigondon", gender: "Female", program: "BS Info Tech", year: 3 },
  { id: "2023-1161-AB", last: "Villegas", first: "Roselle Anne", middle: "Marigondon", gender: "Female", program: "BS Info Tech", year: 4 },
  { id: "2019-1080-AB", last: "Viola", first: "Samantha Grace", middle: "Gato", gender: "Female", program: "BS Info Tech", year: 2 },
  { id: "2024-1032-AB", last: "Ybay", first: "Zyrah", middle: "Adami", gender: "Female", program: "BS Info Tech", year: 3 }
];

async function syncStudents() {
  console.log(`Starting sync for ${studentsData.length} students...`);
  
  // Find or create default program (BS Info Tech)
  let bsitProgram = await prisma.academicProgram.findFirst({
    where: { OR: [{ program_code: "BS Info Tech" }, { program_code: "BSIT" }] }
  });
  
  if (!bsitProgram) {
    let dept = await prisma.department.findFirst({ where: { department_name: "IT Department" } });
    if (!dept) {
      dept = await prisma.department.create({ data: { department_name: "IT Department" } });
    }
    bsitProgram = await prisma.academicProgram.create({
      data: {
        program_code: "BS Info Tech",
        program_name: "Bachelor of Science in Information Technology",
        department_id: dept.department_id
      }
    });
  }

  // Get default password hash
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash("password123", salt);

  // Enroll in all active courses to ensure full eligibility
  const courses = await prisma.course.findMany();

  let updatedCount = 0;
  let createdCount = 0;

  for (const item of studentsData) {
    const cleanMiddle = (!item.middle || item.middle.trim().toUpperCase() === "NONE" || item.middle.trim().toUpperCase() === "NONE")
      ? null
      : item.middle.trim();

    // Check if user exists by institutional_id
    let user = await prisma.user.findUnique({
      where: { institutional_id: item.id }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          institutional_id: item.id,
          password_hash: defaultPasswordHash,
          role: "Student",
          is_active: true
        }
      });
      createdCount++;
    }

    // Check if Student record exists
    const existingStudent = await prisma.student.findUnique({
      where: { student_id: user.user_id }
    });

    if (existingStudent) {
      await prisma.student.update({
        where: { student_id: user.user_id },
        data: {
          first_name: item.first,
          middle_name: cleanMiddle,
          last_name: item.last,
          program_id: bsitProgram.program_id,
          year_level: item.year,
          section: existingStudent.section || "A"
        }
      });
      updatedCount++;
    } else {
      await prisma.student.create({
        data: {
          student_id: user.user_id,
          first_name: item.first,
          middle_name: cleanMiddle,
          last_name: item.last,
          program_id: bsitProgram.program_id,
          year_level: item.year,
          section: "A"
        }
      });
      updatedCount++;
    }

    // Ensure student is enrolled in courses via StudentCourse
    for (const c of courses) {
      const enrolled = await prisma.studentCourse.findUnique({
        where: { student_id_course_id: { student_id: user.user_id, course_id: c.course_id } }
      });
      if (!enrolled) {
        await prisma.studentCourse.create({
          data: { student_id: user.user_id, course_id: c.course_id }
        });
      }
    }
  }

  console.log(`Sync finished! Total data count: ${studentsData.length}. Created users: ${createdCount}, Updated student records: ${updatedCount}.`);
  const finalCount = await prisma.student.count();
  console.log(`Verified total students in DB: ${finalCount}`);
}

syncStudents()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
