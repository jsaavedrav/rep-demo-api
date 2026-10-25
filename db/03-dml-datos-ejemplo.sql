/* =============================================================================
   Declaración REP - Datos de ejemplo (DML)  ·  OPCIONAL
   Ejecutar después de 02-dml-datos-maestros.sql, solo en ambientes de prueba o demo.
   Carga envases del demo y los 100 registros de neumáticos de la especificación.
   Idempotente: se puede correr varias veces.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

/* 3a. Envases: catálogo con componentes y algunas importaciones DIN. */
DECLARE @env TABLE (sku nvarchar(50), nombre nvarchar(150), atributos nvarchar(max), peso_kg decimal(14,6));
INSERT INTO @env VALUES
  (N'BEB-500',  N'Bebida 500 ml (botella)', N'{"material":"Plástico","sub":"PET","clase":"Domiciliario","peligro":"No peligroso"}', 0.022),
  (N'BEB-500',  N'Bebida 500 ml (tapa)',    N'{"material":"Plástico","sub":"PEAD","clase":"Domiciliario","peligro":"No peligroso"}', 0.003),
  (N'JUG-1L',   N'Jugo 1 L',                N'{"material":"Cartón para líquidos","sub":"Multicapa","clase":"Domiciliario","peligro":"No peligroso"}', 0.028),
  (N'CON-330',  N'Conserva 330 g',          N'{"material":"Metal","sub":"Acero","clase":"Domiciliario","peligro":"No peligroso"}', 0.05),
  (N'VIN-750',  N'Vino 750 ml',             N'{"material":"Vidrio","sub":"Vidrio","clase":"Domiciliario","peligro":"No peligroso"}', 0.45),
  (N'AGR-20L',  N'Agroquímico 20 L',        N'{"material":"Plástico","sub":"PEAD","clase":"No domiciliario","peligro":"Peligroso"}', 0.9),
  (N'CAJ-EMB',  N'Caja de embalaje',        N'{"material":"Papel y cartón","sub":"Corrugado","clase":"No domiciliario","peligro":"No peligroso"}', 0.45),
  (N'BEB-1.5L', N'Bebida 1,5 L (botella)',  N'{"material":"Plástico","sub":"PET","clase":"Domiciliario","peligro":"No peligroso"}', NULL),
  (N'BEB-1.5L', N'Bebida 1,5 L (tapa)',     N'{"material":"Plástico","sub":"PEAD","clase":"Domiciliario","peligro":"No peligroso"}', NULL);

DECLARE @env_mov TABLE (documento nvarchar(50), fecha date, proveedor nvarchar(150), sku nvarchar(50), unidades int);
INSERT INTO @env_mov VALUES
  (N'DIN-2026-0101', '2026-01-15', N'Proveedor Andes',    N'BEB-500',  120000),
  (N'DIN-2026-0102', '2026-02-03', N'Proveedor Andes',    N'JUG-1L',    80000),
  (N'DIN-2026-0187', '2026-03-12', N'Vidrios del Sur',    N'VIN-750',   40000),
  (N'DIN-2026-0230', '2026-04-20', N'Agro Import',        N'AGR-20L',    3500),
  (N'DIN-2026-0311', '2026-05-09', N'Metalpack',          N'CON-330',  150000),
  (N'DIN-2026-0355', '2026-07-01', N'Cartonera Pacífico', N'CAJ-EMB',   25000),
  (N'DIN-2026-0390', '2026-08-14', N'Proveedor Andes',    N'BEB-1.5L',  60000);

INSERT INTO rep.sku (programa_id, sku)
SELECT DISTINCT 'env', e.sku FROM @env e
WHERE NOT EXISTS (SELECT 1 FROM rep.sku s WHERE s.programa_id = 'env' AND s.sku = e.sku);

INSERT INTO rep.sku_componente (programa_id, sku, nombre, atributos, peso_kg)
SELECT 'env', e.sku, e.nombre, e.atributos, e.peso_kg FROM @env e
WHERE NOT EXISTS (SELECT 1 FROM rep.sku_componente c WHERE c.programa_id = 'env' AND c.sku = e.sku AND c.nombre = e.nombre);

INSERT INTO rep.movimiento (programa_id, documento, fecha, proveedor, sku, unidades)
SELECT 'env', m.documento, m.fecha, m.proveedor, m.sku, m.unidades FROM @env_mov m
WHERE NOT EXISTS (
  SELECT 1 FROM rep.movimiento x
  WHERE x.programa_id = 'env' AND x.id_origen IS NULL AND x.documento = m.documento AND x.sku = m.sku AND x.fecha = m.fecha
);

/* 3b. Neumáticos: los 100 registros de la especificación ("base de datos" del Excel). */
DECLARE @neu TABLE (
  id_origen nvarchar(50), fecha date, din nvarchar(50), sku nvarchar(50), nombre nvarchar(150),
  atributos nvarchar(max), peso_kg decimal(14,6), unidades int
);
INSERT INTO @neu VALUES
  (N'1', CAST('2024-10-14' AS date), N'DIN-24-126225', N'NEU-93810', N'Maxxis 205/55 R16', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.44, 82),
  (N'2', CAST('2025-01-25' AS date), N'DIN-24-688508', N'NEU-76237', N'Bridgestone 325/95 R24', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 69.99, 213),
  (N'3', CAST('2025-10-09' AS date), N'DIN-24-900581', N'NEU-30379', N'Goodyear 195/65 R15', N'{"marca": "Goodyear", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.87, 94),
  (N'4', CAST('2024-01-22' AS date), N'DIN-24-678856', N'NEU-59615', N'Goodyear 295/80 R22.5', N'{"marca": "Goodyear", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 58.45, 283),
  (N'5', CAST('2025-04-22' AS date), N'DIN-24-498591', N'NEU-40512', N'Goodyear 295/80 R22.5', N'{"marca": "Goodyear", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 56.04, 323),
  (N'6', CAST('2024-11-11' AS date), N'DIN-24-660086', N'NEU-19358', N'Maxxis 325/95 R24', N'{"marca": "Maxxis", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 70.34, 107),
  (N'7', CAST('2025-04-21' AS date), N'DIN-25-380746', N'NEU-51347', N'Michelin 59/80 R63', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5291.95, 17),
  (N'8', CAST('2025-10-13' AS date), N'DIN-24-377746', N'NEU-70142', N'Bridgestone 59/80 R63', N'{"marca": "Bridgestone", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 4979, 13),
  (N'9', CAST('2025-10-03' AS date), N'DIN-25-195325', N'NEU-76784', N'Yokohama 27.00 R49', N'{"marca": "Yokohama", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1519.12, 14),
  (N'10', CAST('2025-11-11' AS date), N'DIN-25-680099', N'NEU-79352', N'Yokohama 195/65 R15', N'{"marca": "Yokohama", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 9.16, 164),
  (N'11', CAST('2025-11-17' AS date), N'DIN-25-624902', N'NEU-10425', N'Yokohama 195/65 R15', N'{"marca": "Yokohama", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 9.33, 673),
  (N'12', CAST('2025-04-02' AS date), N'DIN-24-728038', N'NEU-31174', N'Goodyear 295/80 R22.5', N'{"marca": "Goodyear", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 60.2, 296),
  (N'13', CAST('2024-05-17' AS date), N'DIN-25-955662', N'NEU-21226', N'Michelin 27.00 R49', N'{"marca": "Michelin", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1523.96, 21),
  (N'14', CAST('2025-02-08' AS date), N'DIN-24-847581', N'NEU-80686', N'Goodyear 36.00 R51', N'{"marca": "Goodyear", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2285.76, 9),
  (N'15', CAST('2024-06-03' AS date), N'DIN-24-717024', N'NEU-82603', N'Bridgestone 175/65 R14', N'{"marca": "Bridgestone", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 14, "dimension": "175/65 R14"}', 7.3, 576),
  (N'16', CAST('2024-02-04' AS date), N'DIN-24-858490', N'NEU-38080', N'Pirelli 520/85 R38', N'{"marca": "Pirelli", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Agrícola", "aro": 38, "dimension": "520/85 R38"}', 185.53, 724),
  (N'17', CAST('2024-04-07' AS date), N'DIN-24-806073', N'NEU-71213', N'Maxxis 325/95 R24', N'{"marca": "Maxxis", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 73.64, 244),
  (N'18', CAST('2024-02-25' AS date), N'DIN-25-585100', N'NEU-34050', N'Bridgestone 195/65 R15', N'{"marca": "Bridgestone", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.6, 292),
  (N'19', CAST('2025-05-14' AS date), N'DIN-25-161483', N'NEU-38016', N'Bridgestone 325/95 R24', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 70.31, 763),
  (N'20', CAST('2024-12-11' AS date), N'DIN-25-262316', N'NEU-82845', N'Bridgestone 175/65 R14', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 14, "dimension": "175/65 R14"}', 7.56, 108),
  (N'21', CAST('2024-07-04' AS date), N'DIN-24-159642', N'NEU-79615', N'Pirelli 33.00 R45', N'{"marca": "Pirelli", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 45, "dimension": "33.00 R45"}', 1211.4, 20),
  (N'22', CAST('2024-11-23' AS date), N'DIN-24-539589', N'NEU-91183', N'Maxxis 295/80 R22.5', N'{"marca": "Maxxis", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 60.52, 371),
  (N'23', CAST('2024-09-09' AS date), N'DIN-25-579434', N'NEU-98039', N'Goodyear 195/65 R15', N'{"marca": "Goodyear", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.62, 185),
  (N'24', CAST('2024-11-27' AS date), N'DIN-25-398830', N'NEU-42018', N'Bridgestone 36.00 R51', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2325.69, 19),
  (N'25', CAST('2024-12-11' AS date), N'DIN-25-221035', N'NEU-27601', N'Michelin 235/60 R18', N'{"marca": "Michelin", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 13.69, 258),
  (N'26', CAST('2024-01-11' AS date), N'DIN-25-363319', N'NEU-76244', N'Yokohama 325/95 R24', N'{"marca": "Yokohama", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 74.37, 183),
  (N'27', CAST('2025-10-18' AS date), N'DIN-25-688153', N'NEU-67912', N'Michelin 205/55 R16', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.25, 201),
  (N'28', CAST('2025-10-24' AS date), N'DIN-24-475190', N'NEU-57795', N'Bridgestone 195/65 R15', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.87, 208),
  (N'29', CAST('2025-11-28' AS date), N'DIN-24-532322', N'NEU-31299', N'Michelin 36.00 R51', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2364.95, 25),
  (N'30', CAST('2024-04-01' AS date), N'DIN-25-140605', N'NEU-24168', N'Yokohama 520/85 R38', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Agrícola", "aro": 38, "dimension": "520/85 R38"}', 177.29, 725),
  (N'31', CAST('2024-05-06' AS date), N'DIN-25-468203', N'NEU-19099', N'Maxxis 295/80 R22.5', N'{"marca": "Maxxis", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 60.55, 644),
  (N'32', CAST('2024-05-02' AS date), N'DIN-25-462479', N'NEU-24208', N'Maxxis 195/65 R15', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.9, 775),
  (N'33', CAST('2024-12-10' AS date), N'DIN-24-481913', N'NEU-80575', N'Continental 36.00 R51', N'{"marca": "Continental", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2328.33, 18),
  (N'34', CAST('2024-10-19' AS date), N'DIN-25-681343', N'NEU-62743', N'Bridgestone 325/95 R24', N'{"marca": "Bridgestone", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 73.28, 358),
  (N'35', CAST('2025-11-07' AS date), N'DIN-25-320392', N'NEU-49829', N'Continental 295/80 R22.5', N'{"marca": "Continental", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 57.8, 573),
  (N'36', CAST('2024-11-10' AS date), N'DIN-24-397571', N'NEU-32241', N'Pirelli 295/80 R22.5', N'{"marca": "Pirelli", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 55.64, 280),
  (N'37', CAST('2025-08-13' AS date), N'DIN-24-598216', N'NEU-16057', N'Pirelli 265/65 R17', N'{"marca": "Pirelli", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 16.86, 299),
  (N'38', CAST('2024-08-05' AS date), N'DIN-25-329471', N'NEU-23970', N'Bridgestone 175/65 R14', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 14, "dimension": "175/65 R14"}', 7.54, 525),
  (N'39', CAST('2025-03-24' AS date), N'DIN-25-891937', N'NEU-88047', N'Continental 59/80 R63', N'{"marca": "Continental", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5062.64, 17),
  (N'40', CAST('2024-12-10' AS date), N'DIN-25-903013', N'NEU-93579', N'Yokohama 265/65 R17', N'{"marca": "Yokohama", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 16.13, 290),
  (N'41', CAST('2024-07-14' AS date), N'DIN-24-245095', N'NEU-80798', N'Bridgestone 205/55 R16', N'{"marca": "Bridgestone", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.41, 388),
  (N'42', CAST('2025-08-01' AS date), N'DIN-25-508396', N'NEU-37110', N'Yokohama 33.00 R45', N'{"marca": "Yokohama", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 45, "dimension": "33.00 R45"}', 1242.81, 13),
  (N'43', CAST('2025-12-06' AS date), N'DIN-24-611945', N'NEU-64921', N'Bridgestone 175/65 R14', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 14, "dimension": "175/65 R14"}', 7.42, 528),
  (N'44', CAST('2024-08-06' AS date), N'DIN-24-513160', N'NEU-80008', N'Pirelli 195/65 R15', N'{"marca": "Pirelli", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 9.13, 101),
  (N'45', CAST('2024-08-01' AS date), N'DIN-25-453894', N'NEU-69598', N'Yokohama 325/95 R24', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 70.22, 602),
  (N'46', CAST('2024-10-05' AS date), N'DIN-24-919182', N'NEU-39389', N'Maxxis 27.00 R49', N'{"marca": "Maxxis", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1454.9, 9),
  (N'47', CAST('2024-03-10' AS date), N'DIN-24-587623', N'NEU-83920', N'Maxxis 27.00 R49', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1515.88, 5),
  (N'48', CAST('2025-11-20' AS date), N'DIN-25-515922', N'NEU-85470', N'Maxxis 265/65 R17', N'{"marca": "Maxxis", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 15.84, 173),
  (N'49', CAST('2025-08-04' AS date), N'DIN-25-658623', N'NEU-15383', N'Continental 295/80 R22.5', N'{"marca": "Continental", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 55.17, 493),
  (N'50', CAST('2025-08-14' AS date), N'DIN-24-556641', N'NEU-70258', N'Bridgestone 235/60 R18', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 14.16, 798),
  (N'51', CAST('2025-06-01' AS date), N'DIN-24-392477', N'NEU-42177', N'Continental 59/80 R63', N'{"marca": "Continental", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5156.27, 17),
  (N'52', CAST('2024-02-08' AS date), N'DIN-25-936587', N'NEU-37802', N'Goodyear 235/60 R18', N'{"marca": "Goodyear", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 14.08, 787),
  (N'53', CAST('2024-07-23' AS date), N'DIN-25-777278', N'NEU-41499', N'Maxxis 175/65 R14', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 14, "dimension": "175/65 R14"}', 7.19, 299),
  (N'54', CAST('2025-04-04' AS date), N'DIN-25-546173', N'NEU-72031', N'Maxxis 520/85 R38', N'{"marca": "Maxxis", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Agrícola", "aro": 38, "dimension": "520/85 R38"}', 175.88, 788),
  (N'55', CAST('2024-05-08' AS date), N'DIN-24-300845', N'NEU-80236', N'Bridgestone 235/60 R18', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 14.67, 419),
  (N'56', CAST('2025-02-28' AS date), N'DIN-24-387636', N'NEU-80010', N'Michelin 205/55 R16', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.34, 62),
  (N'57', CAST('2024-07-16' AS date), N'DIN-25-293319', N'NEU-67733', N'Michelin 40.00 R57', N'{"marca": "Michelin", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 57, "dimension": "40.00 R57"}', 3364.93, 4),
  (N'58', CAST('2025-10-20' AS date), N'DIN-24-950544', N'NEU-29887', N'Pirelli 265/65 R17', N'{"marca": "Pirelli", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 15.87, 683),
  (N'59', CAST('2024-10-24' AS date), N'DIN-25-411797', N'NEU-69049', N'Yokohama 36.00 R51', N'{"marca": "Yokohama", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2315.78, 5),
  (N'60', CAST('2025-08-23' AS date), N'DIN-25-792509', N'NEU-37659', N'Michelin 195/65 R15', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.69, 658),
  (N'61', CAST('2024-07-04' AS date), N'DIN-25-837135', N'NEU-47762', N'Yokohama 265/65 R17', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 17.2, 607),
  (N'62', CAST('2025-08-04' AS date), N'DIN-24-174878', N'NEU-44816', N'Michelin 59/80 R63', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5226.97, 16),
  (N'63', CAST('2025-01-03' AS date), N'DIN-25-559023', N'NEU-45683', N'Michelin 325/95 R24', N'{"marca": "Michelin", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 73.69, 284),
  (N'64', CAST('2025-05-06' AS date), N'DIN-24-901909', N'NEU-85392', N'Maxxis 205/55 R16', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.17, 649),
  (N'65', CAST('2025-07-23' AS date), N'DIN-25-464863', N'NEU-21959', N'Continental 195/65 R15', N'{"marca": "Continental", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 9.32, 557),
  (N'66', CAST('2025-09-27' AS date), N'DIN-24-576919', N'NEU-82102', N'Michelin 195/65 R15', N'{"marca": "Michelin", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 9.42, 51),
  (N'67', CAST('2024-04-09' AS date), N'DIN-24-296694', N'NEU-64165', N'Pirelli 520/85 R38', N'{"marca": "Pirelli", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Agrícola", "aro": 38, "dimension": "520/85 R38"}', 182.26, 612),
  (N'68', CAST('2024-09-14' AS date), N'DIN-24-130271', N'NEU-73532', N'Maxxis 27.00 R49', N'{"marca": "Maxxis", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1471.61, 4),
  (N'69', CAST('2025-07-27' AS date), N'DIN-25-223172', N'NEU-24871', N'Maxxis 235/60 R18', N'{"marca": "Maxxis", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 14.01, 544),
  (N'70', CAST('2025-07-11' AS date), N'DIN-24-502219', N'NEU-82255', N'Bridgestone 205/55 R16', N'{"marca": "Bridgestone", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.57, 569),
  (N'71', CAST('2025-08-11' AS date), N'DIN-25-255813', N'NEU-49132', N'Continental 295/80 R22.5', N'{"marca": "Continental", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 58.3, 243),
  (N'72', CAST('2025-07-22' AS date), N'DIN-24-997594', N'NEU-60196', N'Yokohama 520/85 R38', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Agrícola", "aro": 38, "dimension": "520/85 R38"}', 183.69, 717),
  (N'73', CAST('2025-01-24' AS date), N'DIN-24-626690', N'NEU-14852', N'Pirelli 40.00 R57', N'{"marca": "Pirelli", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 57, "dimension": "40.00 R57"}', 3359.9, 6),
  (N'74', CAST('2025-11-28' AS date), N'DIN-24-592296', N'NEU-30232', N'Yokohama 325/95 R24', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 73.08, 596),
  (N'75', CAST('2024-07-04' AS date), N'DIN-24-747453', N'NEU-73956', N'Michelin 235/60 R18', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 14.7, 698),
  (N'76', CAST('2025-03-08' AS date), N'DIN-25-130353', N'NEU-31805', N'Michelin 36.00 R51', N'{"marca": "Michelin", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 51, "dimension": "36.00 R51"}', 2267.45, 18),
  (N'77', CAST('2025-10-05' AS date), N'DIN-24-283573', N'NEU-33600', N'Michelin 59/80 R63', N'{"marca": "Michelin", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5193.4, 9),
  (N'78', CAST('2025-10-10' AS date), N'DIN-24-943718', N'NEU-43466', N'Continental 205/55 R16', N'{"marca": "Continental", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 9.77, 704),
  (N'79', CAST('2025-12-10' AS date), N'DIN-25-308894', N'NEU-69878', N'Continental 325/95 R24', N'{"marca": "Continental", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 72.52, 72),
  (N'80', CAST('2025-05-25' AS date), N'DIN-24-693419', N'NEU-45976', N'Yokohama 33.00 R45', N'{"marca": "Yokohama", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 45, "dimension": "33.00 R45"}', 1249.27, 9),
  (N'81', CAST('2024-05-26' AS date), N'DIN-24-751051', N'NEU-93442', N'Goodyear 27.00 R49', N'{"marca": "Goodyear", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 49, "dimension": "27.00 R49"}', 1519.24, 16),
  (N'82', CAST('2025-09-17' AS date), N'DIN-24-409445', N'NEU-27224', N'Goodyear 265/65 R17', N'{"marca": "Goodyear", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 15.89, 329),
  (N'83', CAST('2024-04-28' AS date), N'DIN-25-882824', N'NEU-73156', N'Yokohama 40.00 R57', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 57, "dimension": "40.00 R57"}', 3662.01, 23),
  (N'84', CAST('2025-10-13' AS date), N'DIN-25-194689', N'NEU-83048', N'Yokohama 195/65 R15', N'{"marca": "Yokohama", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 15, "dimension": "195/65 R15"}', 8.96, 703),
  (N'85', CAST('2025-12-10' AS date), N'DIN-25-126240', N'NEU-40647', N'Pirelli 265/65 R17', N'{"marca": "Pirelli", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 16.74, 714),
  (N'86', CAST('2025-11-24' AS date), N'DIN-25-616554', N'NEU-14877', N'Michelin 205/55 R16', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 10.09, 763),
  (N'87', CAST('2025-04-15' AS date), N'DIN-25-786735', N'NEU-30253', N'Michelin 235/60 R18', N'{"marca": "Michelin", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 13.35, 505),
  (N'88', CAST('2024-08-03' AS date), N'DIN-25-670913', N'NEU-23022', N'Maxxis 235/60 R18', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 13.57, 728),
  (N'89', CAST('2024-10-07' AS date), N'DIN-24-925013', N'NEU-12799', N'Goodyear 59/80 R63', N'{"marca": "Goodyear", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 4949.65, 9),
  (N'90', CAST('2024-02-22' AS date), N'DIN-24-390743', N'NEU-88116', N'Yokohama 59/80 R63', N'{"marca": "Yokohama", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 4972.83, 2),
  (N'91', CAST('2024-08-15' AS date), N'DIN-25-116547', N'NEU-41186', N'Bridgestone 325/95 R24', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 24, "dimension": "325/95 R24"}', 72.19, 420),
  (N'92', CAST('2024-01-16' AS date), N'DIN-24-744986', N'NEU-76039', N'Michelin 59/80 R63', N'{"marca": "Michelin", "tipo": "Macizo", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 4998.83, 14),
  (N'93', CAST('2025-07-20' AS date), N'DIN-24-184714', N'NEU-68138', N'Goodyear 205/55 R16', N'{"marca": "Goodyear", "tipo": "Macizo", "categoria": "Categoría A", "subcategoria": "Automóvil", "aro": 16, "dimension": "205/55 R16"}', 9.97, 593),
  (N'94', CAST('2024-07-15' AS date), N'DIN-24-931621', N'NEU-66387', N'Maxxis 59/80 R63', N'{"marca": "Maxxis", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5212.63, 9),
  (N'95', CAST('2024-11-16' AS date), N'DIN-25-865054', N'NEU-62262', N'Michelin 235/60 R18', N'{"marca": "Michelin", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 18, "dimension": "235/60 R18"}', 13.82, 118),
  (N'96', CAST('2025-11-04' AS date), N'DIN-24-880758', N'NEU-66606', N'Maxxis 59/80 R63', N'{"marca": "Maxxis", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 4875.59, 15),
  (N'97', CAST('2025-04-28' AS date), N'DIN-24-401601', N'NEU-65435', N'Pirelli 265/65 R17', N'{"marca": "Pirelli", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camioneta/SUV", "aro": 17, "dimension": "265/65 R17"}', 15.93, 160),
  (N'98', CAST('2024-10-22' AS date), N'DIN-25-701987', N'NEU-25058', N'Bridgestone 59/80 R63', N'{"marca": "Bridgestone", "tipo": "Diagonal", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5157.92, 24),
  (N'99', CAST('2024-03-24' AS date), N'DIN-25-468074', N'NEU-50499', N'Michelin 59/80 R63', N'{"marca": "Michelin", "tipo": "Radial", "categoria": "Categoría B", "subcategoria": "Minería OTR", "aro": 63, "dimension": "59/80 R63"}', 5180.25, 22),
  (N'100', CAST('2025-10-20' AS date), N'DIN-24-494468', N'NEU-79531', N'Continental 295/80 R22.5', N'{"marca": "Continental", "tipo": "Diagonal", "categoria": "Categoría A", "subcategoria": "Camión/Bus", "aro": 22.5, "dimension": "295/80 R22.5"}', 56.91, 136);

INSERT INTO rep.sku (programa_id, sku)
SELECT DISTINCT 'neu', n.sku FROM @neu n
WHERE NOT EXISTS (SELECT 1 FROM rep.sku s WHERE s.programa_id = 'neu' AND s.sku = n.sku);

INSERT INTO rep.sku_componente (programa_id, sku, nombre, atributos, peso_kg)
SELECT 'neu', n.sku, n.nombre, n.atributos, n.peso_kg FROM @neu n
WHERE NOT EXISTS (SELECT 1 FROM rep.sku_componente c WHERE c.programa_id = 'neu' AND c.sku = n.sku);

INSERT INTO rep.movimiento (programa_id, id_origen, documento, fecha, sku, unidades)
SELECT 'neu', n.id_origen, n.din, n.fecha, n.sku, n.unidades FROM @neu n
WHERE NOT EXISTS (SELECT 1 FROM rep.movimiento x WHERE x.programa_id = 'neu' AND x.id_origen = n.id_origen);

/* 3c. Peso congelado de cada movimiento de ejemplo = peso vigente del componente al cargarlo. */
INSERT INTO rep.movimiento_componente (movimiento_id, componente_id, peso_kg)
SELECT m.id, c.id, c.peso_kg
FROM rep.movimiento m
JOIN rep.sku_componente c ON c.programa_id = m.programa_id AND c.sku = m.sku
WHERE m.programa_id IN ('env', 'neu')
  AND NOT EXISTS (SELECT 1 FROM rep.movimiento_componente x WHERE x.movimiento_id = m.id AND x.componente_id = c.id);

/* 3d. Kilos gestionados de ejemplo: totales por año y categoría de la columna Kilos_Gestionados del Excel. */
INSERT INTO rep.gestion (programa_id, anio, categoria, tipo_meta, kilos, fuente, documento, observacion)
SELECT s.programa_id, s.anio, s.categoria, s.tipo_meta, s.kilos, 'GRANSIC', s.documento, N'Dato de ejemplo'
FROM (VALUES
  ('neu', 2024, N'Categoría A', 'recoleccion',  412374.450, N'DEMO-2024-A'),
  ('neu', 2024, N'Categoría B', 'valorizacion', 473106.110, N'DEMO-2024-B'),
  ('neu', 2025, N'Categoría A', 'recoleccion',  497613.600, N'DEMO-2025-A'),
  ('neu', 2025, N'Categoría B', 'valorizacion', 487725.480, N'DEMO-2025-B')
) AS s (programa_id, anio, categoria, tipo_meta, kilos, documento)
WHERE NOT EXISTS (SELECT 1 FROM rep.gestion g WHERE g.programa_id = s.programa_id AND g.documento = s.documento);

COMMIT TRANSACTION;
