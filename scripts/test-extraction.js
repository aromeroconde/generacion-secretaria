
const n8nResponse = [
    {
        "markdown": "# Base de Conocimiento – Bot Neoflex Plus (Versión Demo)\n\n## ¿Qué es Neoflex Plus?\n\nNeoflex Plus es un suplemento nutricional en polvo diseñado para adultos que buscan mantenerse activos, con vitalidad y bienestar en una etapa de la vida donde cuidarse es una decisión consciente. Es una fórmula integral que combina colágeno hidrolizado, proteínas, probióticos, prebióticos, vitaminas y minerales.\n\n## ¿Para quién está recomendado?\n\n*   Adultos que comienzan a experimentar cambios naturales en su cuerpo.\n*   Mujeres 40+ y hombres 50+ que desean mantenerse activos y fuertes.\n*   Adultos mayores que buscan apoyo nutricional práctico.\n\n## Principales beneficios\n\n*   Apoya la salud articular y la movilidad.\n*   Contribuye al mantenimiento de la masa muscular.\n*   Favorece la salud digestiva gracias a probióticos y prebióticos.\n*   Aporta vitaminas y minerales esenciales para el bienestar general.\n\n## Ingredientes destacados\n\n*   Colágeno hidrolizado\n*   Proteína de suero de leche\n*   Probióticos y prebióticos\n*   Vitaminas A, B, C, D, E y K\n*   Minerales como calcio, zinc, magnesio e hierro\n*   Endulzado con stevia, sin azúcar añadida\n\n## ¿Cómo se consume?\n\nMezcla una cucharada (15 g) en 200 ml de agua, leche o jugo. Se recomienda usar una licuadora para mejor disolución.\n\n## Mensaje clave de la marca\n\nNeoflex Plus no viene a cambiarte, viene a acompañarte. Es un aliado práctico para quienes ya saben lo que quieren y desean seguir disfrutando lo que han construido con energía y confianza.\n\n## Tono que debe usar el bot\n\n*   Cercano y empático\n*   Claro y directo\n*   Positivo sin exagerar\n*   Inspirador, sin clichés\n\nDocumento de prueba para entrenamiento inicial de bot conversacional."
    }
];

function extractText(obj) {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj.map(extractText).join("\n\n");

    // Priority keys
    if (obj.markdown) return extractText(obj.markdown);
    if (obj.text) return extractText(obj.text);
    if (obj.content) return extractText(obj.content);
    if (obj.parts) return extractText(obj.parts); // Gemini structure

    return "";
}

const result = extractText(n8nResponse);
console.log(result);
