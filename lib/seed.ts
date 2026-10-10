import type { Settings, Topic, Track } from './types';

/**
 * GATE 2027 Robotics & Automation (RA) syllabus, IIT Madras.
 * Paper: GA 15 + Part A 60 (A.1 Maths, A.2 Mechatronics, A.3 Robotics & Automation)
 *        + Part B 25 (choose B1 Electrical or B2 Mechanical inside the exam).
 *
 * Hours are planning estimates (theory + worked examples + topic PYQs) for someone
 * with a mechanical background. Edit them on the Syllabus page; the plan reflows.
 * Array order inside each track is the study order.
 */
type Row = [section: string, subject: string, topic: string, est: number];

export const SECTIONS = {
  GA: 'General Aptitude',
  MATH: 'Engineering Mathematics',
  MECH: 'Basics of Mechatronics',
  ROBO: 'Robotics & Automation',
  B2: 'Mechanical (B2)',
  B1: 'Electrical (B1)',
} as const;

const S = SECTIONS;

/** Maths + aptitude stream: studied in parallel with the core stream every day. */
const MATH_TRACK: Row[] = [
  [S.MATH, 'Linear Algebra', 'Matrices: transpose, determinant, rank, trace, adjoint', 6],
  [S.MATH, 'Linear Algebra', 'Systems of linear equations', 4],
  [S.MATH, 'Linear Algebra', 'Eigenvalues and eigenvectors', 5],
  [S.GA, 'Quantitative aptitude', 'Numbers, percentages, ratios, averages', 4],
  [S.MATH, 'Calculus', 'Limits, continuity, differentiability, indeterminate forms', 4],
  [S.MATH, 'Calculus', 'Mean value theorems, Taylor series (one and two variables)', 4],
  [S.MATH, 'Calculus', 'Definite, improper, double and triple integrals', 5],
  [S.MATH, 'Calculus', 'Partial and total derivatives, maxima and minima', 4],
  [S.GA, 'Verbal aptitude', 'Grammar, vocabulary, sentence completion', 4],
  [S.MATH, 'Vector Calculus', 'Gradient, divergence, curl, vector identities', 4],
  [S.MATH, 'Differential Equations', 'First-order linear and nonlinear ODEs', 4],
  [S.MATH, 'Differential Equations', 'Higher-order linear ODEs, Euler–Cauchy, IVP and BVP', 5],
  [S.MATH, 'Differential Equations', 'Laplace transforms', 5],
  [S.GA, 'Quantitative aptitude', 'Time and work, speed and distance, P&C, data interpretation', 5],
  [S.MATH, 'Differential Equations', 'Fourier series; heat, wave and Laplace equations', 6],
  [S.MATH, 'Probability & Statistics', 'Axioms, conditional probability, Bayes theorem', 4],
  [S.MATH, 'Probability & Statistics', 'Random variables, expectation, PDF and CDF', 4],
  [S.MATH, 'Probability & Statistics', 'Mean, median, mode, SD; binomial, Poisson, normal', 5],
  [S.MATH, 'Probability & Statistics', 'Hypothesis testing', 3],
  [S.GA, 'Analytical & spatial reasoning', 'Puzzles, series, spatial and figure reasoning', 5],
  [S.MATH, 'Numerical Methods', 'Roots of equations (bisection, Newton–Raphson), linear systems', 4],
  [S.MATH, 'Numerical Methods', "Trapezoidal and Simpson's rules, finite differences", 3],
  [S.MATH, 'Numerical Methods', 'Single and multi-step methods for ODEs (Euler, RK)', 3],
  [S.GA, 'Verbal aptitude', 'Reading comprehension, critical reasoning', 4],
  [S.MATH, 'PYQ practice', 'Maths PYQs from ME, EE, IN and DA papers', 12],
  [S.GA, 'PYQ practice', 'Timed aptitude sets', 4],
];

/** Core stream: mechanics first (familiar), robotics after linear algebra is done. */
const CORE_TRACK: Row[] = [
  [S.MECH, 'Engineering Mechanics', 'Free-body diagrams, equilibrium, trusses and frames', 6],
  [S.MECH, 'Engineering Mechanics', 'Friction, rolling friction, belt–pulley', 4],
  [S.MECH, 'Engineering Mechanics', 'Kinematics and dynamics of rigid bodies in plane motion', 6],
  [S.B2, 'Mechanics of Materials', "Stress, strain, elastic constants, Mohr's circle", 6],
  [S.B2, 'Mechanics of Materials', 'Shear force and bending moment diagrams', 5],
  [S.B2, 'Mechanics of Materials', 'Bending and shear stresses, shear centre', 4],
  [S.B2, 'Mechanics of Materials', 'Deflection of beams', 5],
  [S.B2, 'Mechanics of Materials', 'Torsion of circular shafts, Euler columns', 4],
  [S.B2, 'Mechanics of Materials', 'Thin cylinders, thermal stresses, Castigliano theorems', 4],
  [S.B2, 'Mechanics of Materials', 'Strain gauges and rosettes; UTM, hardness and impact tests', 2],
  [S.B2, 'PYQ practice', 'Engineering mechanics and SOM PYQs (ME papers)', 8],
  [S.ROBO, 'Robotics', 'Classification, serial vs parallel, configurations, joints, DOF, frames', 4],
  [S.ROBO, 'Robotics', 'Rotation matrices in 2D and 3D', 5],
  [S.ROBO, 'Robotics', 'Homogeneous transformations', 5],
  [S.ROBO, 'Robotics', 'Forward kinematics (DH convention)', 7],
  [S.ROBO, 'Robotics', 'PTP and continuous-path control, end-effectors, accuracy and repeatability', 3],
  [S.ROBO, 'PYQ practice', 'Transformation and forward-kinematics numericals', 5],
  [S.B2, 'Kinematics & Dynamics', 'Velocity and acceleration analysis of plane mechanisms', 6],
  [S.B2, 'Kinematics & Dynamics', 'Dynamic analysis of linkages', 3],
  [S.B2, 'Kinematics & Dynamics', 'Gears and gear trains', 5],
  [S.B2, 'Kinematics & Dynamics', 'Balancing of rotating and reciprocating masses; gyroscope', 4],
  [S.B2, 'Kinematics & Dynamics', 'Free and forced SDOF vibration, damping, isolation, critical speeds', 7],
  [S.B2, 'PYQ practice', 'TOM and vibrations PYQs (ME papers)', 6],
  [S.MECH, 'Electrical Networks', 'Sources, R/L/C/M, KCL/KVL, nodal and mesh analysis', 6],
  [S.MECH, 'Electrical Networks', 'Thevenin, Norton, superposition, maximum power transfer', 5],
  [S.MECH, 'Electrical Networks', 'Transient response of DC and AC networks', 5],
  [S.MECH, 'Electrical Networks', 'Sinusoidal steady state, resonance', 4],
  [S.MECH, 'Electrical Networks', 'Two-port networks', 3],
  [S.MECH, 'Electrical Networks', 'Balanced three-phase, complex power, power factor', 3],
  [S.MECH, 'Digital Circuits', 'Boolean algebra, K-maps, MUX, encoders, decoders', 6],
  [S.MECH, 'Digital Circuits', 'Flip-flops and counters', 5],
  [S.MECH, 'Sensors & Actuators', 'Resistive, capacitive, inductive, piezo, Hall sensors + signal conditioning', 7],
  [S.MECH, 'Sensors & Actuators', 'Transducers: displacement, velocity, acceleration, force, torque, pressure', 4],
  [S.MECH, 'Sensors & Actuators', 'Hydraulic and pneumatic actuators', 4],
  [S.MECH, 'Sensors & Actuators', 'DC, stepper and servo motors; torque–speed characteristics', 5],
  [S.MECH, 'PYQ practice', 'Networks, digital, sensors PYQs (EE and IN papers)', 8],
  [S.MECH, 'Programming', 'Flowcharts, pseudocode; Python data types, operators, expressions', 3],
  [S.MECH, 'Programming', 'Python control flow: if/elif/else, match-case, loops, break/continue', 3],
  [S.MECH, 'Programming', 'Python functions, recursion, arrays, strings, dictionaries', 5],
  [S.MECH, 'Data Structures', 'Stack, queue, linked list', 5],
  [S.MECH, 'Data Structures', 'Binary search tree, binary heap', 5],
  [S.MECH, 'Data Structures', 'Graphs: representation, BFS, DFS', 4],
  [S.MECH, 'PYQ practice', 'Python and data structures PYQs (DA and CS papers)', 5],
  [S.ROBO, 'Computer Integrated Manufacturing', 'Automation in manufacturing; concurrent design, planning for automation', 3],
  [S.ROBO, 'Computer Integrated Manufacturing', 'PLCs: ladder logic, timers, counters', 6],
  [S.ROBO, 'Computer Integrated Manufacturing', 'Automated material handling, AS/RS', 3],
  [S.ROBO, 'Computer Integrated Manufacturing', 'Automated identification and data capture', 2],
  [S.ROBO, 'Computer Integrated Manufacturing', 'CNC fundamentals and part programming', 4],
  [S.ROBO, 'Computer Integrated Manufacturing', 'Single and multi-axis positioning systems', 3],
  [S.ROBO, 'PYQ practice', 'CIM, PLC and CNC PYQs (PI papers)', 5],
  [S.B2, 'Machine Design & CIM', 'Static and dynamic loading, failure theories', 4],
  [S.B2, 'Machine Design & CIM', 'Fatigue strength, S–N diagram', 4],
  [S.B2, 'Machine Design & CIM', 'Bolted, riveted and welded joints', 4],
  [S.B2, 'Machine Design & CIM', 'Shafts; rolling and sliding contact bearings', 5],
  [S.B2, 'Machine Design & CIM', 'Brakes, clutches, springs', 5],
  [S.B2, 'Machine Design & CIM', 'CAD/CAM integration; additive manufacturing', 3],
  [S.B2, 'PYQ practice', 'Machine design PYQs (ME papers)', 5],
];

/** Optional B1 track, switched off by default. Turn topics on from the Syllabus page. */
const B1_TRACK: Row[] = [
  [S.B1, 'Analog & Embedded', 'Analog filters; amplifier biasing, small-signal models, frequency response', 8],
  [S.B1, 'Analog & Embedded', 'Feedback amplifiers, op-amp applications, oscillators', 7],
  [S.B1, 'Analog & Embedded', 'VCOs, timers, Schmitt trigger, sample-and-hold, ADC/DAC, SMPS', 6],
  [S.B1, 'Analog & Embedded', 'Microcontrollers: CPU, memory, I/O, timers, interrupts, interfacing, DAQ', 8],
  [S.B1, 'Signals & Systems', 'CT/DT signals, shifting and scaling, LTI and causal systems', 5],
  [S.B1, 'Signals & Systems', 'Fourier series, Fourier/Laplace/Z transforms, sampling theorem, RMS', 9],
  [S.B1, 'Control Systems', 'Modelling, transfer functions, block diagrams, signal flow graphs', 5],
  [S.B1, 'Control Systems', 'Transient and steady-state response of LTI systems', 5],
  [S.B1, 'Control Systems', 'Routh–Hurwitz, Nyquist, Bode plots, root locus', 8],
  [S.B1, 'Control Systems', 'Lag, lead, lead-lag compensators; P, PI, PID', 5],
];

function build(rows: Row[], prefix: string, track: Track, active: boolean, orderBase: number): Topic[] {
  return rows.map(([section, subject, topic, est], i) => ({
    id: `${prefix}${String(i + 1).padStart(2, '0')}`,
    section,
    subject,
    topic,
    track,
    est,
    order: orderBase + i + 1,
    active,
    doneOn: '',
    notes: '',
  }));
}

export const SEED_TOPICS: Topic[] = [
  ...build(MATH_TRACK, 'M', 'math', true, 0),
  ...build(CORE_TRACK, 'C', 'core', true, 0),
  ...build(B1_TRACK, 'E', 'core', false, 500),
];

export const DEFAULT_SETTINGS: Settings = {
  startDate: '2026-10-11',
  syllabusEnd: '2026-12-31',
  revisionStart: '2027-01-01',
  revisionEnd: '2027-01-31',
  // GATE 2027 runs on 6, 7, 13, 14, 20, 21 Feb 2027; set this once the RA paper date is out.
  examDate: '2027-02-06',
  // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  hours: [9, 4, 4, 4, 4, 4, 9],
  mode: 'uniform',
  mathShare: 'auto',
  revisionLoad: 0.9,
  mockHours: 5,
};

/** Display order of sections across the app and in the revision round. */
export const SECTION_ORDER: string[] = [S.MATH, S.MECH, S.ROBO, S.B2, S.B1, S.GA];
