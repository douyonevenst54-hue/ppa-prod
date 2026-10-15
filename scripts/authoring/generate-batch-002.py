# -*- coding: utf-8 -*-
import csv, sys

Q = []
def q(cat, diff, text, answer, *distractors):
    Q.append((text, answer, " | ".join([answer, *distractors]), cat, diff))

# ─────────── GENERAL ───────────
q("GENERAL","EASY","What is the capital of Haiti?","Port-au-Prince","Cap-Haïtien","Jacmel","Les Cayes")
q("GENERAL","EASY","Which island does Haiti share with the Dominican Republic?","Hispaniola","Cuba","Jamaica","Puerto Rico")
q("GENERAL","EASY","How many days are in a leap year?","366","364","365","367")
q("GENERAL","EASY","What is the official currency of Haiti?","Gourde","Peso","Franc","Guilder")
q("GENERAL","EASY","Which ocean lies to the east of the United States?","Atlantic Ocean","Pacific Ocean","Indian Ocean","Arctic Ocean")
q("GENERAL","EASY","How many sides does a hexagon have?","6","5","7","8")
q("GENERAL","EASY","Which is the largest continent by land area?","Asia","Africa","North America","Europe")

q("GENERAL","MEDIUM","In which year did Haiti declare its independence?","1804","1791","1825","1776")
q("GENERAL","MEDIUM","Which is the longest river in Africa?","Nile","Congo","Niger","Zambezi")
q("GENERAL","MEDIUM","What is the capital of Jamaica?","Kingston","Montego Bay","Spanish Town","Ocho Rios")
q("GENERAL","MEDIUM","Which mountain range runs along the western edge of South America?","Andes","Rocky Mountains","Atlas Mountains","Ural Mountains")
q("GENERAL","MEDIUM","How many time zones does the contiguous United States span?","4","3","5","6")
q("GENERAL","MEDIUM","What is the chemical symbol for gold?","Au","Ag","Gd","Go")
q("GENERAL","MEDIUM","Which is the largest island in the Caribbean?","Cuba","Hispaniola","Jamaica","Puerto Rico")

q("GENERAL","HARD","Who led the Haitian Revolution until his capture and deportation in 1802?","Toussaint Louverture","Jean-Jacques Dessalines","Henri Christophe","Alexandre Pétion")
q("GENERAL","HARD","Which leader proclaimed Haiti's independence on 1 January 1804?","Jean-Jacques Dessalines","Toussaint Louverture","Henri Christophe","Alexandre Pétion")
q("GENERAL","HARD","What is the highest mountain in Haiti?","Pic la Selle","Pic Macaya","Morne Bois Pin","Pic Cabaio")
q("GENERAL","HARD","Which settlement ended the Thirty Years' War?","Peace of Westphalia","Treaty of Versailles","Treaty of Utrecht","Congress of Vienna")
q("GENERAL","HARD","What is the SI unit of electrical resistance?","Ohm","Volt","Ampere","Watt")
q("GENERAL","HARD","Which element has atomic number 26?","Iron","Copper","Zinc","Nickel")
q("GENERAL","HARD","In which year did the Berlin Wall fall?","1989","1987","1990","1991")

# ─────────── TECH ───────────
q("TECH","EASY","What does CPU stand for?","Central Processing Unit","Computer Power Unit","Core Program Utility","Central Program Unit")
q("TECH","EASY","In a web address, what does www stand for?","World Wide Web","Wide Web World","Web Wire World","World Web Wide")
q("TECH","EASY","What does URL stand for?","Uniform Resource Locator","Universal Reference Link","Unified Routing Layer","User Request Line")
q("TECH","EASY","What does RAM stand for?","Random Access Memory","Rapid Allocation Module","Read And Modify","Runtime Access Memory")
q("TECH","EASY","What does PDF stand for?","Portable Document Format","Printed Document File","Public Data Form","Page Display Format")
q("TECH","EASY","In computing, what does a gigabyte measure?","Storage or memory size","Screen resolution","Processor speed","Battery life")
q("TECH","EASY","What is a web browser used for?","Viewing websites","Printing documents","Editing photos only","Charging a device")

q("TECH","MEDIUM","What is the purpose of a firewall?","To control which network traffic is allowed through","To cool the processor","To store passwords securely","To speed up downloads")
q("TECH","MEDIUM","What does it mean for software to be open source?","Its source code is publicly available","It is always free of charge","It runs only on Linux","It has no copyright holder")
q("TECH","MEDIUM","Which data structure serves items first-in, first-out?","Queue","Stack","Binary tree","Graph")
q("TECH","MEDIUM","What does SQL stand for?","Structured Query Language","Simple Question Language","Standard Quality Logic","Sequential Query Layer")
q("TECH","MEDIUM","What is the main purpose of a VPN?","To route traffic through an encrypted connection","To speed up a hard drive","To compress images","To back up files")
q("TECH","MEDIUM","What is the decimal number 8 in binary?","1000","100","1010","110")
q("TECH","MEDIUM","In an IP address, what does IP stand for?","Internet Protocol","Internal Pathway","Information Packet","Instruction Pointer")

q("TECH","HARD","What does a cryptographic hash function guarantee about its output?","A fixed length regardless of input size","That it can be reversed","That it is unique for every possible input","That it is encrypted")
q("TECH","HARD","In public-key cryptography, which key is shared openly?","The public key","The private key","The session key","The signing key")
q("TECH","HARD","What is the average time complexity of a hash table lookup?","O(1)","O(n)","O(log n)","O(n log n)")
q("TECH","HARD","Which port does HTTPS use by default?","443","80","22","8080")
q("TECH","HARD","What distinguishes symmetric from asymmetric encryption?","Symmetric uses one shared key; asymmetric uses a key pair","Symmetric is always stronger","Asymmetric cannot be used over the internet","Symmetric requires no key at all")
q("TECH","HARD","What does a race condition describe?","Two operations whose result depends on unpredictable timing","A slow network connection","A full disk","An infinite loop")
q("TECH","HARD","In Git, what does a commit hash identify?","A specific snapshot of the repository","A branch name","A remote server","A merge conflict")

# ─────────── FINANCE ───────────
q("FINANCE","EASY","What is a bank statement?","A record of the transactions in an account","A loan application","A credit limit increase","A tax bill")
q("FINANCE","EASY","What does it mean to save money?","To set money aside for later use","To spend it straight away","To lend it to someone else","To give it away")
q("FINANCE","EASY","What does ATM stand for?","Automated Teller Machine","Account Transfer Method","Automatic Transaction Model","Authorized Transfer Machine")
q("FINANCE","EASY","What does a bank pay you for keeping money in a savings account?","Interest","Rent","Commission","Dividends")
q("FINANCE","EASY","What is a debit card linked to?","Your bank account","A line of credit","A savings bond","A mortgage")
q("FINANCE","EASY","In personal finance, what is income?","Money you receive","Money you owe","Money you spend","Money you borrow")
q("FINANCE","EASY","What is a receipt?","A record of a payment made","A request for payment","A loan agreement","A tax return")

q("FINANCE","MEDIUM","What is a down payment?","An upfront portion of a purchase price","The final payment of a loan","A monthly interest charge","A fully refundable deposit")
q("FINANCE","MEDIUM","What does a credit score mainly measure?","How likely you are to repay borrowed money","How much money you have","Your yearly income","How long you have been employed")
q("FINANCE","MEDIUM","What is inflation?","A general rise in prices over time","A fall in interest rates","A rise in wages only","A reduction in taxes")
q("FINANCE","MEDIUM","What is the difference between gross pay and net pay?","Net pay is what remains after deductions","Net pay is the amount before deductions","They are the same thing","Gross pay excludes overtime")
q("FINANCE","MEDIUM","In the United States, what is a 401(k)?","An employer-based retirement savings plan","A type of health insurance","A federal tax form","A student loan programme")
q("FINANCE","MEDIUM","What does liquidity describe?","How quickly an asset can be turned into cash","How much an asset is worth","How risky an asset is","How long an asset lasts")
q("FINANCE","MEDIUM","In insurance, what is a deductible?","The amount you pay before coverage starts","The monthly payment","The maximum the insurer will pay","A refund at year end")

q("FINANCE","HARD","What does diversification reduce in an investment portfolio?","Exposure to any single asset","Total fees paid","Tax liability","Inflation")
q("FINANCE","HARD","What does the balance sheet equation state?","Assets equal liabilities plus equity","Revenue minus expenses equals profit","Assets equal revenue","Equity equals revenue minus tax")
q("FINANCE","HARD","What is an index fund?","A fund that tracks a market index","A fund managed by daily trading","A government bond","A savings certificate")
q("FINANCE","HARD","For a loan, what does amortization describe?","Paying the balance down over scheduled payments","Increasing the interest rate over time","Deferring all payments to the end","Selling the debt to another lender")
q("FINANCE","HARD","What is the primary role of a central bank?","Managing monetary policy and the currency","Issuing personal loans","Collecting income tax","Insuring homes")
q("FINANCE","HARD","What does a bond's yield refer to?","The return it pays relative to its price","Its face value","Its maturity date","Its credit rating")
q("FINANCE","HARD","What does opportunity cost mean?","The value of the next best alternative given up","The fee charged by a broker","The cost of borrowing money","The loss caused by inflation")

# ─────────── SOCIAL ───────────
q("SOCIAL","EASY","What is the most effective everyday way to stop germs from spreading?","Washing your hands","Taking vitamins","Drinking cold water","Opening a window")
q("SOCIAL","EASY","How many hours of sleep a night are generally recommended for adults?","7 to 9","3 to 4","5 to 6","10 to 12")
q("SOCIAL","EASY","What does CPR stand for?","Cardiopulmonary resuscitation","Cardiac Pressure Relief","Central Pulse Recovery","Chest Pressure Routine")
q("SOCIAL","EASY","Which nutrients do fruits and vegetables mainly provide?","Vitamins and fibre","Saturated fat","Refined sugar","Cholesterol")
q("SOCIAL","EASY","What number do you call for an emergency in the United States?","911","411","211","999")
q("SOCIAL","EASY","What does a community health worker do?","Connects people to health services in their own community","Runs a hospital's finances","Designs medical devices","Manufactures medicines")
q("SOCIAL","EASY","What should you always do before preparing food?","Wash your hands","Open a window","Turn off the lights","Weigh the ingredients")

q("SOCIAL","MEDIUM","What does herd immunity describe?","Protection across a population when enough people are immune","Immunity passed from parent to child","Immunity to only one infection","A category of vaccine")
q("SOCIAL","MEDIUM","Why is a trained interpreter used in a medical visit?","So the patient and the provider understand each other accurately","To fill out insurance forms","To take the doctor's notes","To schedule the next appointment")
q("SOCIAL","MEDIUM","What do the social determinants of health refer to?","Conditions such as housing, income and education that shape health","Inherited genetic risk factors","Hospital staffing levels","The cost of prescriptions")
q("SOCIAL","MEDIUM","What is a food desert?","An area with limited access to affordable fresh food","A region with very little rainfall","A method of preserving food","A government nutrition programme")
q("SOCIAL","MEDIUM","What is the purpose of a health screening?","To find a condition early, before symptoms appear","To treat an illness already diagnosed","To issue prescriptions","To certify fitness for work")
q("SOCIAL","MEDIUM","What does WHO stand for?","World Health Organization","Worldwide Hospital Office","World Humanitarian Operation","Working Health Office")
q("SOCIAL","MEDIUM","What is health literacy?","The ability to find and understand health information","The ability to read in any language","Formal medical training","Knowing first aid")

q("SOCIAL","HARD","In epidemiology, what does incidence measure?","New cases arising over a period of time","All existing cases at one moment","Deaths caused by a disease","Cases per hospital")
q("SOCIAL","HARD","In epidemiology, what does prevalence measure?","All existing cases at a point in time","Only newly arising cases","The rate of recovery","The speed of transmission")
q("SOCIAL","HARD","What is a cohort study?","Following a group over time to see who develops an outcome","Comparing people who already have an outcome with those who do not","A report on a single patient","A laboratory experiment on cells")
q("SOCIAL","HARD","What distinguishes health equity from health equality?","Equity gives people what each one needs; equality gives everyone the same","They mean the same thing","Equity means identical funding everywhere","Equality accounts for differing need")
q("SOCIAL","HARD","What does informed consent require?","That a person understands the risks and agrees voluntarily","A signature on a form","Approval from a family member","A doctor's recommendation")
q("SOCIAL","HARD","What is primary prevention?","Stopping a health problem before it occurs","Treating an illness in its early stage","Rehabilitating someone after illness","Screening for existing disease")
q("SOCIAL","HARD","What does harm reduction aim to do?","Reduce the damage from a behaviour that may continue","Eliminate the behaviour immediately","Penalise risky behaviour","Replace medical treatment")

# ─────────── SPORTS ───────────
q("SPORTS","EASY","How many players from one soccer team are on the field at a time?","11","9","10","12")
q("SPORTS","EASY","In which sport is a score of love used?","Tennis","Golf","Cricket","Boxing")
q("SPORTS","EASY","How many holes are played in a full round of golf?","18","9","12","24")
q("SPORTS","EASY","In basketball, how many points is a free throw worth?","1","2","3","4")
q("SPORTS","EASY","Which sport is played with a bat, a ball and four bases?","Baseball","Field hockey","Rugby","Volleyball")
q("SPORTS","EASY","How often are the Summer Olympic Games normally held?","Every four years","Every two years","Every year","Every five years")
q("SPORTS","EASY","What shape is a standard soccer field?","Rectangular","Oval","Circular","Square")

q("SPORTS","MEDIUM","In which city were the first modern Olympic Games held?","Athens","Paris","London","Rome")
q("SPORTS","MEDIUM","How many players from one volleyball team are on the court?","6","5","7","8")
q("SPORTS","MEDIUM","In soccer, what does a red card mean?","The player is sent off","A final warning","A penalty kick is awarded","A substitution is required")
q("SPORTS","MEDIUM","How long is a standard soccer match, not counting stoppage time?","90 minutes","60 minutes","80 minutes","100 minutes")
q("SPORTS","MEDIUM","How many players from one cricket team are on the field?","11","9","10","12")
q("SPORTS","MEDIUM","In bowling, what is three strikes in a row called?","A turkey","A hat-trick","A triple","A strike-out")
q("SPORTS","MEDIUM","In which sport would a player perform a slam dunk?","Basketball","Volleyball","Handball","Water polo")

q("SPORTS","HARD","In tennis, what is the score called when both players reach 40?","Deuce","Advantage","Match point","Break point")
q("SPORTS","HARD","How many interlocking rings appear on the Olympic flag?","5","4","6","7")
q("SPORTS","HARD","What is the offside rule in soccer concerned with?","A player's position relative to the defenders and the ball","The number of substitutions allowed","Handling the ball in open play","Wasting time near the end")
q("SPORTS","HARD","In soccer, what is a hat-trick?","Three goals scored by one player in a match","Three saves in a row","Three corners in a row","Three yellow cards in a match")
q("SPORTS","HARD","How long is a marathon?","42.195 kilometres","40 kilometres","50 kilometres","26 kilometres")
q("SPORTS","HARD","How long is a standard professional boxing round?","3 minutes","2 minutes","4 minutes","5 minutes")
q("SPORTS","HARD","How many players from one rugby union team are on the field?","15","13","11","12")

# ─────────── POLITICS ───────────
q("POLITICS","EASY","How many states are in the United States?","50","48","51","52")
q("POLITICS","EASY","What is the capital of the United States?","Washington, D.C.","New York City","Philadelphia","Boston")
q("POLITICS","EASY","What is the capital of Massachusetts?","Boston","Worcester","Springfield","Cambridge")
q("POLITICS","EASY","How many US senators does each state have?","2","1","3","4")
q("POLITICS","EASY","Which document begins with the words We the People?","The US Constitution","The Declaration of Independence","The Bill of Rights","The Emancipation Proclamation")
q("POLITICS","EASY","How long is one term for a US president?","4 years","2 years","5 years","6 years")
q("POLITICS","EASY","What is the minimum voting age in US federal elections?","18","16","20","21")

q("POLITICS","MEDIUM","How many voting members are in the US House of Representatives?","435","400","500","535")
q("POLITICS","MEDIUM","How long is one term for a US senator?","6 years","4 years","2 years","8 years")
q("POLITICS","MEDIUM","What are the first ten amendments to the US Constitution called?","The Bill of Rights","The Articles of Confederation","The Preamble","The Federalist Papers")
q("POLITICS","MEDIUM","Which branch of the US government interprets the laws?","Judicial","Legislative","Executive","Administrative")
q("POLITICS","MEDIUM","How many justices sit on the US Supreme Court?","9","7","11","12")
q("POLITICS","MEDIUM","What is it called when the US House brings formal charges against a president?","Impeachment","Censure","Recall","Indictment")
q("POLITICS","MEDIUM","In the United States, which body must approve a treaty?","The Senate","The House of Representatives","The Supreme Court","The Cabinet")

q("POLITICS","HARD","What is habeas corpus?","A legal challenge to unlawful detention","A guarantee of free speech","An exemption from taxation","A right to trial by jury")
q("POLITICS","HARD","How many electoral votes are needed to win the US presidency?","270","250","218","300")
q("POLITICS","HARD","What does separation of powers describe?","Dividing authority among branches of government","Separating church and state","Splitting federal and state taxation","Dividing the political parties")
q("POLITICS","HARD","What is a filibuster in the US Senate?","Extended debate used to delay a vote","A budget reconciliation procedure","A closed committee hearing","An override of a veto")
q("POLITICS","HARD","What fraction of US states must ratify a constitutional amendment for it to take effect?","Three-quarters","Two-thirds","A simple majority","All of them")
q("POLITICS","HARD","What is judicial review?","Courts deciding whether a law is constitutional","An inquiry into a judge's conduct","An appeal against a sentence","A revision of a statute by the legislature")
q("POLITICS","HARD","What is the Massachusetts state legislature called?","The General Court","The State Assembly","The House of Burgesses","The Legislative Council")

# ---- self-check before writing ----
problems = []
seen = {}
for i,(text,ans,opts,cat,diff) in enumerate(Q, start=2):
    o = [x.strip() for x in opts.split("|")]
    if ans not in o: problems.append(f"row {i}: answer not in options -> {text[:50]}")
    if len(o) != 4: problems.append(f"row {i}: {len(o)} options -> {text[:50]}")
    if len(set(x.lower() for x in o)) != len(o): problems.append(f"row {i}: duplicate option -> {text[:50]}")
    k = " ".join(text.lower().split())
    if k in seen: problems.append(f"row {i}: duplicate of row {seen[k]}")
    seen[k] = i
    if cat not in ("GENERAL","TECH","FINANCE","SOCIAL","SPORTS","POLITICS"): problems.append(f"row {i}: bad category")
    if diff not in ("EASY","MEDIUM","HARD"): problems.append(f"row {i}: bad difficulty")

from collections import Counter
cells = Counter((c,d) for _,_,_,c,d in Q)

if problems:
    print("PROBLEMS:"); [print("  "+p) for p in problems]; sys.exit(1)

with open("/home/claude/ppa-prod/data/question-batch-002.csv","w",newline="",encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\n")
    w.writerow(["text","answer_key","options","category","difficulty"])
    for row in Q: w.writerow(row)

print(f"{len(Q)} questions written, all self-checks pass")
print(f"cells covered: {len(cells)}/18, per cell: {sorted(set(cells.values()))}")
