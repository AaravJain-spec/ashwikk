"""National syllabi reference data.

Compact, curated lists of subjects + chapter-level topics for the most common
country/class combinations. Used as a fallback when the student doesn't upload
a custom syllabus.

Structure:
    NATIONAL_SYLLABI[country] = {
        "name": "Curriculum display name",
        "flag": "🇮🇳",
        "classes": { "10": { "Mathematics": [...topics...], ... }, ... }
    }
"""
from __future__ import annotations

NATIONAL_SYLLABI: dict = {
    "India": {
        "name": "CBSE NCERT",
        "flag": "🇮🇳",
        "classes": {
            "8": {
                "Mathematics": [
                    "Rational Numbers", "Linear Equations in One Variable",
                    "Understanding Quadrilaterals", "Practical Geometry",
                    "Data Handling", "Squares and Square Roots",
                    "Cubes and Cube Roots", "Comparing Quantities",
                    "Algebraic Expressions", "Visualising Solid Shapes",
                    "Mensuration", "Exponents and Powers", "Direct and Inverse Proportions",
                    "Factorisation", "Introduction to Graphs", "Playing with Numbers",
                ],
                "Science": [
                    "Crop Production and Management", "Microorganisms",
                    "Synthetic Fibres and Plastics", "Materials: Metals and Non-Metals",
                    "Coal and Petroleum", "Combustion and Flame", "Conservation of Plants and Animals",
                    "Cell Structure and Functions", "Reproduction in Animals",
                    "Reaching the Age of Adolescence", "Force and Pressure",
                    "Friction", "Sound", "Chemical Effects of Electric Current",
                    "Some Natural Phenomena", "Light", "Stars and the Solar System",
                    "Pollution of Air and Water",
                ],
                "Social Science": [
                    "How When and Where", "From Trade to Territory", "Ruling the Countryside",
                    "Resources", "Land Soil Water Natural Vegetation Wildlife",
                    "The Indian Constitution", "Understanding Secularism",
                ],
                "English": [
                    "Honeydew Prose", "Honeydew Poetry", "It So Happened",
                    "Grammar and Writing",
                ],
            },
            "9": {
                "Mathematics": [
                    "Number Systems", "Polynomials", "Coordinate Geometry",
                    "Linear Equations in Two Variables", "Introduction to Euclid's Geometry",
                    "Lines and Angles", "Triangles", "Quadrilaterals",
                    "Areas of Parallelograms and Triangles", "Circles",
                    "Constructions", "Heron's Formula", "Surface Areas and Volumes",
                    "Statistics", "Probability",
                ],
                "Science": [
                    "Matter in Our Surroundings", "Is Matter Around Us Pure",
                    "Atoms and Molecules", "Structure of the Atom",
                    "The Fundamental Unit of Life", "Tissues",
                    "Diversity in Living Organisms", "Motion",
                    "Force and Laws of Motion", "Gravitation", "Work and Energy",
                    "Sound", "Why Do We Fall Ill", "Natural Resources",
                    "Improvement in Food Resources",
                ],
                "Social Science": [
                    "The French Revolution", "Socialism in Europe and the Russian Revolution",
                    "Nazism and the Rise of Hitler", "Forest Society and Colonialism",
                    "Pastoralists in the Modern World", "India - Size and Location",
                    "Physical Features of India", "Drainage", "Climate",
                    "Natural Vegetation and Wildlife", "Population",
                    "What is Democracy", "Constitutional Design",
                    "Electoral Politics", "Working of Institutions",
                    "The Story of Village Palampur", "People as Resource",
                    "Poverty as a Challenge", "Food Security in India",
                ],
                "English": [
                    "Beehive Prose", "Beehive Poetry", "Moments Stories",
                    "Grammar", "Writing Skills",
                ],
            },
            "10": {
                "Mathematics": [
                    "Real Numbers", "Polynomials",
                    "Pair of Linear Equations in Two Variables", "Quadratic Equations",
                    "Arithmetic Progressions", "Triangles", "Coordinate Geometry",
                    "Introduction to Trigonometry", "Some Applications of Trigonometry",
                    "Circles", "Areas Related to Circles", "Surface Areas and Volumes",
                    "Statistics", "Probability",
                ],
                "Science": [
                    "Chemical Reactions and Equations", "Acids Bases and Salts",
                    "Metals and Non-Metals", "Carbon and its Compounds",
                    "Life Processes", "Control and Coordination",
                    "How do Organisms Reproduce", "Heredity and Evolution",
                    "Light - Reflection and Refraction",
                    "The Human Eye and the Colourful World", "Electricity",
                    "Magnetic Effects of Electric Current", "Our Environment",
                ],
                "Social Science": [
                    "The Rise of Nationalism in Europe", "Nationalism in India",
                    "The Making of a Global World", "The Age of Industrialisation",
                    "Resources and Development", "Forest and Wildlife Resources",
                    "Water Resources", "Agriculture", "Minerals and Energy Resources",
                    "Manufacturing Industries", "Power Sharing", "Federalism",
                    "Democracy and Diversity", "Political Parties",
                    "Development", "Sectors of the Indian Economy", "Money and Credit",
                    "Globalisation and the Indian Economy",
                ],
                "English": [
                    "First Flight Prose", "First Flight Poetry",
                    "Footprints Without Feet", "Grammar", "Writing Skills",
                ],
            },
            "11": {
                "Physics": [
                    "Physical World", "Units and Measurements",
                    "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion",
                    "Work Energy and Power", "Rotational Motion", "Gravitation",
                    "Mechanical Properties of Solids", "Mechanical Properties of Fluids",
                    "Thermal Properties of Matter", "Thermodynamics",
                    "Kinetic Theory", "Oscillations", "Waves",
                ],
                "Chemistry": [
                    "Some Basic Concepts of Chemistry", "Structure of Atom",
                    "Classification of Elements and Periodicity", "Chemical Bonding",
                    "States of Matter", "Thermodynamics", "Equilibrium",
                    "Redox Reactions", "Hydrogen", "s-Block Elements",
                    "p-Block Elements", "Organic Chemistry - Basic Principles",
                    "Hydrocarbons", "Environmental Chemistry",
                ],
                "Mathematics": [
                    "Sets", "Relations and Functions", "Trigonometric Functions",
                    "Mathematical Induction", "Complex Numbers", "Linear Inequalities",
                    "Permutations and Combinations", "Binomial Theorem",
                    "Sequences and Series", "Straight Lines", "Conic Sections",
                    "Three Dimensional Geometry", "Limits and Derivatives",
                    "Statistics", "Probability",
                ],
                "Biology": [
                    "The Living World", "Biological Classification", "Plant Kingdom",
                    "Animal Kingdom", "Morphology of Flowering Plants",
                    "Anatomy of Flowering Plants", "Structural Organisation in Animals",
                    "Cell - The Unit of Life", "Biomolecules",
                    "Cell Cycle and Cell Division", "Transport in Plants",
                    "Mineral Nutrition", "Photosynthesis", "Respiration in Plants",
                    "Plant Growth and Development", "Digestion and Absorption",
                    "Breathing and Exchange of Gases", "Body Fluids and Circulation",
                    "Excretory Products", "Locomotion and Movement",
                    "Neural Control and Coordination", "Chemical Coordination",
                ],
            },
            "12": {
                "Physics": [
                    "Electric Charges and Fields",
                    "Electrostatic Potential and Capacitance", "Current Electricity",
                    "Moving Charges and Magnetism", "Magnetism and Matter",
                    "Electromagnetic Induction", "Alternating Current",
                    "Electromagnetic Waves", "Ray Optics", "Wave Optics",
                    "Dual Nature of Radiation and Matter", "Atoms", "Nuclei",
                    "Semiconductor Electronics",
                ],
                "Chemistry": [
                    "Solid State", "Solutions", "Electrochemistry",
                    "Chemical Kinetics", "Surface Chemistry",
                    "Isolation of Elements", "p-Block Elements",
                    "d and f-Block Elements", "Coordination Compounds",
                    "Haloalkanes and Haloarenes", "Alcohols Phenols and Ethers",
                    "Aldehydes Ketones and Carboxylic Acids", "Amines",
                    "Biomolecules", "Polymers", "Chemistry in Everyday Life",
                ],
                "Mathematics": [
                    "Relations and Functions", "Inverse Trigonometric Functions",
                    "Matrices", "Determinants", "Continuity and Differentiability",
                    "Application of Derivatives", "Integrals",
                    "Application of Integrals", "Differential Equations",
                    "Vector Algebra", "Three Dimensional Geometry",
                    "Linear Programming", "Probability",
                ],
                "Biology": [
                    "Reproduction in Organisms", "Sexual Reproduction in Flowering Plants",
                    "Human Reproduction", "Reproductive Health",
                    "Principles of Inheritance and Variation",
                    "Molecular Basis of Inheritance", "Evolution",
                    "Human Health and Disease",
                    "Strategies for Enhancement in Food Production",
                    "Microbes in Human Welfare", "Biotechnology - Principles",
                    "Biotechnology and its Applications",
                    "Organisms and Populations", "Ecosystem",
                    "Biodiversity and Conservation", "Environmental Issues",
                ],
            },
        },
    },

    "United States": {
        "name": "Common Core / AP",
        "flag": "🇺🇸",
        "classes": {
            "9": {
                "Algebra I": [
                    "Linear Equations", "Linear Inequalities", "Functions",
                    "Systems of Equations", "Exponents and Polynomials",
                    "Factoring", "Quadratic Functions",
                    "Radical and Rational Expressions", "Data Analysis",
                ],
                "Biology": [
                    "Cell Structure and Function", "Cellular Respiration",
                    "Photosynthesis", "Cell Division", "Genetics",
                    "DNA and Heredity", "Evolution", "Classification", "Ecology",
                    "Ecosystems and Biomes",
                ],
                "English Language Arts I": [
                    "Reading Literature", "Reading Informational Text",
                    "Writing Arguments", "Narrative Writing",
                    "Vocabulary Acquisition", "Speaking and Listening",
                ],
                "World History": [
                    "Early Civilizations", "Classical Empires", "Medieval World",
                    "Renaissance and Reformation", "Age of Exploration",
                    "Enlightenment", "Industrial Revolution",
                ],
            },
            "10": {
                "Geometry": [
                    "Congruence", "Similarity",
                    "Right Triangles and Trigonometry", "Circles",
                    "Geometric Measurement", "Geometric Modeling",
                    "Conditional Probability",
                ],
                "Chemistry": [
                    "Atomic Structure", "Periodic Table", "Chemical Bonding",
                    "Chemical Reactions", "Stoichiometry", "Gas Laws",
                    "Solutions", "Acids and Bases", "Thermochemistry",
                    "Equilibrium",
                ],
                "English Language Arts II": [
                    "American Literature", "Critical Analysis",
                    "Research Writing", "Rhetoric", "Public Speaking",
                ],
                "U.S. History": [
                    "Colonial America", "American Revolution",
                    "Constitution", "Civil War", "Reconstruction",
                    "Industrialization", "Progressive Era", "World Wars",
                    "Cold War", "Civil Rights",
                ],
            },
            "11": {
                "Algebra II": [
                    "Polynomial Functions", "Rational Functions",
                    "Exponential Functions", "Logarithmic Functions",
                    "Trigonometry", "Sequences and Series",
                    "Statistics and Probability",
                ],
                "Physics": [
                    "Kinematics", "Forces and Motion", "Energy", "Momentum",
                    "Waves", "Sound", "Light and Optics", "Electricity",
                    "Magnetism", "Modern Physics",
                ],
                "English Language Arts III": [
                    "British Literature", "Essay Writing", "Research Paper",
                    "Literary Criticism",
                ],
                "Government and Civics": [
                    "Constitution", "Branches of Government", "Civil Liberties",
                    "Civil Rights", "Political Parties", "Elections",
                    "Public Policy",
                ],
            },
            "12": {
                "Pre-Calculus / AP Calculus": [
                    "Functions and Graphs", "Limits", "Derivatives",
                    "Applications of Derivatives", "Integrals",
                    "Applications of Integrals", "Differential Equations",
                ],
                "AP Biology / Environmental Science": [
                    "Biochemistry", "Cell Biology", "Genetics", "Evolution",
                    "Ecology", "Environmental Issues", "Sustainability",
                ],
                "English Language Arts IV": [
                    "World Literature", "Senior Research", "Composition",
                    "Rhetoric and Argumentation",
                ],
                "Economics": [
                    "Microeconomics", "Macroeconomics", "Markets",
                    "International Trade", "Personal Finance",
                ],
            },
        },
    },

    "United Kingdom": {
        "name": "National Curriculum (GCSE/A-Level)",
        "flag": "🇬🇧",
        "classes": {
            "10": {
                "GCSE Mathematics": [
                    "Number", "Algebra", "Ratio and Proportion",
                    "Geometry and Measures", "Probability", "Statistics",
                ],
                "GCSE Combined Science": [
                    "Cell Biology", "Organisation", "Infection and Response",
                    "Bioenergetics", "Atomic Structure", "Bonding",
                    "Quantitative Chemistry", "Energy Changes", "Forces",
                    "Waves", "Magnetism and Electromagnetism",
                ],
                "GCSE English Language": [
                    "Reading Fiction", "Narrative Writing",
                    "Reading Non-Fiction", "Persuasive Writing",
                ],
                "GCSE English Literature": [
                    "Shakespeare", "19th Century Novel", "Modern Texts",
                    "Poetry Anthology", "Unseen Poetry",
                ],
                "GCSE History": [
                    "Britain: Power and the People", "Germany 1890-1945",
                    "Conflict and Tension", "Health and the People",
                ],
            },
            "12": {
                "A-Level Mathematics": [
                    "Pure Mathematics: Algebra", "Pure Mathematics: Calculus",
                    "Pure Mathematics: Trigonometry", "Statistics", "Mechanics",
                ],
                "A-Level Physics": [
                    "Mechanics", "Materials", "Waves", "Electricity",
                    "Particles and Quantum Phenomena",
                    "Further Mechanics and Thermal Physics",
                    "Fields", "Nuclear Physics",
                ],
                "A-Level Chemistry": [
                    "Atomic Structure", "Bonding", "Energetics", "Kinetics",
                    "Equilibria", "Redox", "Inorganic Chemistry",
                    "Organic Chemistry", "Analysis",
                ],
                "A-Level Biology": [
                    "Biological Molecules", "Cells", "Exchange and Transport",
                    "Genetic Information", "Energy Transfers", "Response",
                    "Genetics and Ecosystems",
                ],
            },
        },
    },

    "Canada": {
        "name": "Provincial Curriculum",
        "flag": "🇨🇦",
        "classes": {
            "10": {
                "Mathematics": [
                    "Linear Functions", "Systems of Linear Equations",
                    "Quadratic Functions", "Trigonometry of Right Triangles",
                    "Measurement", "Statistics",
                ],
                "Science": [
                    "Sustainability of Ecosystems", "Atoms and Elements",
                    "Chemical Reactions", "Optics", "Motion",
                ],
                "English": [
                    "Literature Analysis", "Composition", "Media Studies",
                    "Oral Communication",
                ],
                "Social Studies": [
                    "Canadian History", "Canadian Geography",
                    "Canadian Government", "Indigenous Studies",
                ],
            },
            "11": {
                "Functions": [
                    "Characteristics of Functions", "Exponential Functions",
                    "Discrete Functions", "Trigonometric Functions",
                ],
                "Physics": [
                    "Kinematics", "Forces", "Energy and Society", "Waves",
                    "Electricity and Magnetism",
                ],
                "Chemistry": [
                    "Matter and Bonding", "Chemical Reactions",
                    "Quantities in Chemical Reactions", "Solutions",
                    "Gases", "Hydrocarbons",
                ],
                "Biology": [
                    "Diversity of Living Things", "Evolution", "Genetics",
                    "Animals: Anatomy and Physiology",
                    "Plants: Anatomy and Physiology",
                ],
            },
        },
    },

    "Australia": {
        "name": "Australian Curriculum",
        "flag": "🇦🇺",
        "classes": {
            "10": {
                "Mathematics": [
                    "Number and Algebra", "Measurement and Geometry",
                    "Statistics and Probability",
                ],
                "Science": [
                    "Biological Sciences", "Chemical Sciences",
                    "Earth and Space Sciences", "Physical Sciences",
                ],
                "English": ["Literature", "Literacy", "Language"],
                "HASS": [
                    "History", "Geography", "Civics and Citizenship",
                    "Economics and Business",
                ],
            },
            "12": {
                "Mathematical Methods": [
                    "Functions and Graphs", "Calculus",
                    "Statistics and Probability",
                ],
                "Physics": [
                    "Heating Processes", "Electrical Circuits", "Motion",
                    "Waves and Light", "Atomic and Nuclear",
                ],
                "Chemistry": [
                    "Chemical Earth", "Metals", "Water", "Energy",
                    "Industrial Chemistry",
                ],
                "Biology": [
                    "Life on Earth", "Evolution of Australian Biota",
                    "Genetics", "Maintaining a Balance",
                ],
            },
        },
    },
}


def list_countries() -> list[dict]:
    return [
        {"country": k, "name": v["name"], "flag": v["flag"]}
        for k, v in NATIONAL_SYLLABI.items()
    ]


def list_classes(country: str) -> list[str]:
    entry = NATIONAL_SYLLABI.get(country)
    if not entry:
        return []
    return sorted(entry["classes"].keys(), key=lambda x: int(x))


def get_syllabus(country: str, class_level: str) -> dict | None:
    """Return {'name': ..., 'subjects': {Subject: [topics]}} or None."""
    entry = NATIONAL_SYLLABI.get(country)
    if not entry:
        return None
    cls = entry["classes"].get(str(class_level))
    if not cls:
        return None
    return {
        "country": country,
        "class_level": str(class_level),
        "name": entry["name"],
        "flag": entry["flag"],
        "subjects": cls,
    }
