// As animações do menu (`domAnimation`) num chunk à parte, carregado pelo `LazyMotion` do navbar
// depois do primeiro ecrã: o bundle inicial de cada página só leva o núcleo do framer-motion (#389).
import { domAnimation } from 'framer-motion';

export default domAnimation;
