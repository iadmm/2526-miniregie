<filter id="glitch" primitiveUnits="objectBoundingBox" x="-10%" y="0%" width="120%" height="100%">
    <feColorMatrix in="SourceGraphic" result="red" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/> 
    <feColorMatrix in="SourceGraphic" result="green" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"/> 
    <feColorMatrix in="SourceGraphic" result="blue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"/> 
    <feOffset in="red" result="red-shifted" dx="-0.01" dy="0">
    <animate attributeName="dx" keyTimes="0;0.0851;0.1476;0.2459;0.3010;0.6184;0.7263;1" values="0.0018;0.0061;0.0063;0.0095;0.0065;0.0085;0.0062;0.0077" begin="0" dur="5.8s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    <animate attributeName="dy" keyTimes="0;0.0851;0.1476;0.2459;0.3010;0.6184;0.7263;1" values="0.0018;0.0061;0.0063;0.0095;0.0065;0.0085;0.0062;0.0077" begin="0" dur="5.8s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blue" result="blue-shifted" dx="0.01" dy="0">
    <animate attributeName="dx" keyTimes="0;0.0977;0.1870;0.2484;0.4662;0.6727;0.6913;1" values="0.0022;0.0021;0.0058;0.0087;0.0072;0.0021;0.0079;0.0040" begin="0" dur="6.38s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    <animate attributeName="dy" keyTimes="0;0.0977;0.1870;0.2484;0.4662;0.6727;0.6913;1" values="0.0022;0.0021;0.0058;0.0087;0.0072;0.0021;0.0079;0.0040" begin="0" dur="6.38s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feBlend mode="screen" in="red-shifted" in2="green" result="red-green"/>
    <feBlend mode="screen" in="red-green" in2="blue-shifted" result="blended"/>
    <feOffset in="blended" dx="0" dy="0" y="0%" height="13%" result="slice_0">
        <animate attributeName="dx" keyTimes="0;0.1334;0.1601;0.3695;0.6336;0.8366;0.9359;1" values="0.0042;0.0047;0.0049;0.0084;0.0061;0.0038;0.0044;0.0066" begin="0s" dur="2.6961s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1334;0.1601;0.3695;0.6336;0.8366;0.9359;1" values="0.0042;0.0047;0.0049;0.0084;0.0061;0.0038;0.0044;0.0066" begin="0s" dur="2.6961s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="13%" height="11%" result="slice_1">
        <animate attributeName="dx" keyTimes="0;0.1565;0.3026;0.3579;0.4857;0.6662;0.8452;1" values="0.0021;0.0032;0.0019;0.0070;0.0019;0.0020;0.0070;0.0049" begin="0s" dur="2.2599s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1565;0.3026;0.3579;0.4857;0.6662;0.8452;1" values="0.0021;0.0032;0.0019;0.0070;0.0019;0.0020;0.0070;0.0049" begin="0s" dur="2.2599s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="24%" height="16%" result="slice_2">
        <animate attributeName="dx" keyTimes="0;0.5013;0.5642;0.6183;0.7469;0.8979;0.9188;1" values="0.0065;0.0071;0.0050;0.0078;0.0021;0.0063;0.0024;0.0087" begin="0s" dur="2.6762s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.5013;0.5642;0.6183;0.7469;0.8979;0.9188;1" values="0.0065;0.0071;0.0050;0.0078;0.0021;0.0063;0.0024;0.0087" begin="0s" dur="2.6762s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="40%" height="15%" result="slice_3">
        <animate attributeName="dx" keyTimes="0;0.1614;0.3331;0.6837;0.7000;0.7484;0.9392;1" values="0.0051;0.0021;0.0037;0.0083;0.0096;0.0020;0.0084;0.0023" begin="0s" dur="2.6796s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1614;0.3331;0.6837;0.7000;0.7484;0.9392;1" values="0.0051;0.0021;0.0037;0.0083;0.0096;0.0020;0.0084;0.0023" begin="0s" dur="2.6796s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="55%" height="17%" result="slice_4">
        <animate attributeName="dx" keyTimes="0;0.1527;0.3169;0.7318;0.7556;0.8039;0.8842;1" values="0.0063;0.0091;0.0065;0.0043;0.0065;0.0051;0.0077;0.0033" begin="0s" dur="1.966s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1527;0.3169;0.7318;0.7556;0.8039;0.8842;1" values="0.0063;0.0091;0.0065;0.0043;0.0065;0.0051;0.0077;0.0033" begin="0s" dur="1.966s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="72%" height="6%" result="slice_5">
        <animate attributeName="dx" keyTimes="0;0.1965;0.2576;0.6433;0.7095;0.9629;0.9745;1" values="0.0069;0.0014;0.0042;0.0061;0.0016;0.0063;0.0088;0.0079" begin="0s" dur="2.2765s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1965;0.2576;0.6433;0.7095;0.9629;0.9745;1" values="0.0069;0.0014;0.0042;0.0061;0.0016;0.0063;0.0088;0.0079" begin="0s" dur="2.2765s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="78%" height="7%" result="slice_6">
        <animate attributeName="dx" keyTimes="0;0.3167;0.3380;0.3571;0.7459;0.7964;0.8053;1" values="0.0054;0.0015;0.0013;0.0024;0.0013;0.0069;0.0057;0.0040" begin="0s" dur="2.4387s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.3167;0.3380;0.3571;0.7459;0.7964;0.8053;1" values="0.0054;0.0015;0.0013;0.0024;0.0013;0.0069;0.0057;0.0040" begin="0s" dur="2.4387s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feOffset in="blended" dx="0" dy="0" y="85%" height="15%" result="slice_7">
        <animate attributeName="dx" keyTimes="0;0.1041;0.3850;0.4621;0.4641;0.5575;0.7437;1" values="0.0069;0.0063;0.0024;0.0053;0.0067;0.0045;0.0026;0.0073" begin="0s" dur="2.104s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
        <animate attributeName="dy" keyTimes="0;0.1041;0.3850;0.4621;0.4641;0.5575;0.7437;1" values="0.0069;0.0063;0.0024;0.0053;0.0067;0.0045;0.0026;0.0073" begin="0s" dur="2.104s" calcMode="discrete" repeatCount="indefinite" fill="freeze"/>
    </feOffset>
    <feMerge>
    <feMergeNode in="slice_0"/><feMergeNode in="slice_1"/><feMergeNode in="slice_2"/><feMergeNode in="slice_3"/><feMergeNode in="slice_4"/><feMergeNode in="slice_5"/><feMergeNode in="slice_6"/><feMergeNode in="slice_7"/>
    </feMerge>
</filter>