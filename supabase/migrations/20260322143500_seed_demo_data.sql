insert into users (email, full_name, role) values
('admin@ndmii.gov.ng','Amina Bello','admin'),
('reviewer@ndmii.gov.ng','Ifeanyi Okoro','reviewer'),
('officer@fccpc.gov.ng','Tolu Adebayo','fccpc_officer'),
('officer@firs.gov.ng','Kehinde Sani','firs_officer'),
('assoc.lagos@ndmii.ng','Adaobi Nwosu','association_officer'),
('assoc.kano@ndmii.ng','Ibrahim Musa','association_officer');

insert into associations (name, state, sector)
values
('Lagos MSME Manufacturers Guild','Lagos','Manufacturing'),
('Kano Retail Cooperative','Kano','Retail'),
('Rivers Agro Cluster','Rivers','Agro-processing'),
('FCT Creative Enterprise Union','FCT','Creative'),
('Oyo Service Providers Network','Oyo','Services');

insert into msmes (msme_id, business_name, owner_name, state, sector, nin, bvn, cac_number, tin, verification_status)
values
('NDMII-LAG-0001','Eko Fresh Foods Ltd','Chinedu Eze','Lagos','Agro-processing','NIN1000001','BVN1000001','RC1000001','TIN1000001','verified'),
('NDMII-LAG-0002','Mainland Garments','Aisha Lawal','Lagos','Manufacturing','NIN1000002','BVN1000002','RC1000002','TIN1000002','verified'),
('NDMII-LAG-0003','Lekki Home Care','Bola Ade','Lagos','Services','NIN1000003','BVN1000003','RC1000003','TIN1000003','pending'),
('NDMII-KAN-0004','Arewa Retail Hub','Musa Idris','Kano','Retail','NIN1000004','BVN1000004','RC1000004','TIN1000004','verified'),
('NDMII-KAN-0005','Kano Spice Mills','Fatima Bello','Kano','Agro-processing','NIN1000005','BVN1000005','RC1000005','TIN1000005','verified'),
('NDMII-KAN-0006','Dala Textiles','Sani Umar','Kano','Manufacturing','NIN1000006','BVN1000006','RC1000006','TIN1000006','pending'),
('NDMII-RIV-0007','Port Harvest','Ngozi Amadi','Rivers','Agro-processing','NIN1000007','BVN1000007','RC1000007','TIN1000007','verified'),
('NDMII-RIV-0008','Bonny Marine Services','Tamuno Jack','Rivers','Services','NIN1000008','BVN1000008','RC1000008','TIN1000008','verified'),
('NDMII-RIV-0009','Niger Delta Works','Peter Briggs','Rivers','Manufacturing','NIN1000009','BVN1000009','RC1000009','TIN1000009','pending'),
('NDMII-FCT-0010','Abuja Digital Studio','Maryam Aliyu','FCT','Creative','NIN1000010','BVN1000010','RC1000010','TIN1000010','verified'),
('NDMII-FCT-0011','Garki Retail Mart','Ola Tunde','FCT','Retail','NIN1000011','BVN1000011','RC1000011','TIN1000011','verified'),
('NDMII-FCT-0012','Central Facility Managers','David Ekanem','FCT','Services','NIN1000012','BVN1000012','RC1000012','TIN1000012','pending'),
('NDMII-OYO-0013','Ibadan Cocoa Processors','Kemi Akin','Oyo','Agro-processing','NIN1000013','BVN1000013','RC1000013','TIN1000013','verified'),
('NDMII-OYO-0014','Ring Road Fabricators','Femi Afolabi','Oyo','Manufacturing','NIN1000014','BVN1000014','RC1000014','TIN1000014','verified'),
('NDMII-OYO-0015','Oyo Retail Point','Rasheed Balogun','Oyo','Retail','NIN1000015','BVN1000015','RC1000015','TIN1000015','pending'),
('NDMII-ENU-0016','Coal City Bakers','Obi Nnamdi','Enugu','Retail','NIN1000016','BVN1000016','RC1000016','TIN1000016','verified'),
('NDMII-ENU-0017','Nsukka Creative Prints','Chioma Ugwu','Enugu','Creative','NIN1000017','BVN1000017','RC1000017','TIN1000017','verified'),
('NDMII-ENU-0018','Enugu Power Solutions','Kingsley Odo','Enugu','Services','NIN1000018','BVN1000018','RC1000018','TIN1000018','pending'),
('NDMII-LAG-0019','Yaba Tech Assembly','Daniel Ogbonna','Lagos','Manufacturing','NIN1000019','BVN1000019','RC1000019','TIN1000019','verified'),
('NDMII-KAN-0020','Sabon Gari Traders','Hauwa Sule','Kano','Retail','NIN1000020','BVN1000020','RC1000020','TIN1000020','pending');

insert into complaints (msme_id, complaint_type, description, status)
select id, 'consumer_rights', 'Delayed product delivery report', 'open' from msmes limit 5;

insert into payments (msme_id, amount, tax_type)
select id, 125000.00, 'VAT_SIM' from msmes limit 8;

insert into compliance_profiles (msme_id, score, risk_level)
select id, 78 + (row_number() over()) % 20, 'medium' from msmes limit 12;

insert into manufacturer_profiles (msme_id, product_category, traceability_code, standards_status)
select id, 'General Goods', 'TRACE-' || substr(msme_id, 7, 4) || '-' || right(msme_id, 4), 'compliant' from msmes where sector = 'Manufacturing';

insert into activity_logs (action, entity_type, metadata)
values
('seed_import','system','{"source":"demo_seed"}'),
('role_bootstrap','system','{"roles":7}');
