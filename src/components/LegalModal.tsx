import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
}

export function LegalModal({
  isOpen,
  initialTab = 'terms',
  onClose,
}: LegalModalProps) {
  const [tab, setTab] = useState<'terms' | 'privacy'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Términos de Uso y Política de Privacidad"
    >
      <div className="w-full max-w-2xl max-h-[88dvh] bg-[#0F111A] text-zinc-200 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 bg-[#131622] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {tab === 'terms' ? (
              <FileText className="w-5 h-5 text-[#E84393]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#00B4D8]" />
            )}
            <h2 className="font-display text-lg font-bold text-white">
              {tab === 'terms' ? 'Términos de Uso' : 'Política de Privacidad'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso legal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 bg-[#131622] border-b border-white/5 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('terms')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'terms'
                ? 'bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white shadow'
                : 'bg-[#0F111A] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            Términos de Uso
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'privacy'
                ? 'bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7] text-white shadow'
                : 'bg-[#0F111A] text-zinc-400 hover:text-white border border-white/10'
            }`}
          >
            Política de Privacidad
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 text-sm text-zinc-300 leading-relaxed">
          {tab === 'terms' ? (
            <>
              <header className="p-4 rounded-2xl bg-[#161926] border border-white/10 space-y-1">
                <h3 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white">
                  TÉRMINOS DE USO DE VIROKLIPZ
                </h3>
                <p className="text-xs font-medium text-[#00B4D8]">
                  Última actualización: Noviembre 2026
                </p>
              </header>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  1. Aceptación de los Términos
                </h4>
                <p>
                  Al acceder, registrarte o usar Viroklipz (la &quot;Plataforma&quot;), aceptas estar sujeto a estos Términos de Uso. Viroklipz es una Aplicación Web Progresiva (PWA) operada como un emprendimiento tecnológico. Si no estás de acuerdo con estos términos, no uses la Plataforma.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  2. Elegibilidad y Registro
                </h4>
                <div className="space-y-2">
                  <p>
                    <strong className="font-semibold text-white">Edad:</strong> Debes tener al menos 18 años para crear una cuenta de forma independiente. Si eres menor de 18 años, solo podrás registrarte si cuentas con la autorización expresa de tu padre, madre o representante legal, cuyos datos deberán ser suministrados en el formulario de registro.
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Seguridad:</strong> Eres responsable de mantener la confidencialidad de tu contraseña. Viroklipz no se hace responsable por accesos no autorizados derivados de tu negligencia.
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Nombres de usuario:</strong> Para evitar suplantaciones, Viroklipz puede asignar un identificador numérico a tu nombre de usuario si este ya está en uso por otra persona.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  3. Contenido del Usuario y Propiedad Intelectual
                </h4>
                <div className="space-y-2">
                  <p>
                    <strong className="font-semibold text-white">Tu Contenido:</strong> Conservas todos los derechos de propiedad intelectual sobre los videos, textos y audios que publiques (Feed o LIVE).
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Licencia para Viroklipz:</strong> Al publicar contenido, otorgas a Viroklipz una licencia mundial, gratuita y no exclusiva para alojar, reproducir y mostrar tu contenido dentro de la Plataforma con el fin de operar el servicio.
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Derechos de Autor:</strong> Queda estrictamente prohibido subir música o videos que infrinjan los derechos de autor de terceros. Viroklipz respeta el derecho de autor y eliminará cualquier contenido reportado por infracción.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  4. Conducta Prohibida
                </h4>
                <p>No está permitido publicar contenido que:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>Sea ilegal, violento, discriminatorio, de acoso o discurso de odio.</li>
                  <li>Contenga material de abuso sexual infantil (CSAM) o desnudez no consentida.</li>
                  <li>Promueva el spam, estafas financieras o la distribución de malware.</li>
                  <li>Viole las leyes de la República Bolivariana de Venezuela o normativas internacionales.</li>
                </ul>
                <p>
                  Viroklipz se reserva el derecho de suspender o eliminar cualquier cuenta que viole estas reglas sin previo aviso.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  5. Monetización, Monedas y Regalos (VEX Pay)
                </h4>
                <div className="space-y-2">
                  <p>
                    <strong className="font-semibold text-white">Monedas Virtuales:</strong> Viroklipz permite la compra de monedas virtuales mediante pasarelas de pago como VEX Pay (Pago Móvil, Criptomonedas, etc.).
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Naturaleza de las Monedas:</strong> Las monedas y los regalos virtuales no tienen valor monetario en el mundo real y no son reembolsables por dinero en efectivo.
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Uso en Lives:</strong> Los usuarios pueden enviar regalos a los creadores. Viroklipz retiene una comisión por el uso de la plataforma.
                  </p>
                  <p>
                    <strong className="font-semibold text-white">Retiros:</strong> Los creadores podrán solicitar el retiro de sus ganancias siempre que cumplan con los requisitos mínimos y las políticas de verificación de identidad exigidas por nuestras pasarelas de pago. Cualquier actividad fraudulenta (como devoluciones de cargo o uso de tarjetas robadas) resultará en el bloqueo permanente del saldo y la cuenta.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  6. Transmisiones en Vivo (Live)
                </h4>
                <div className="space-y-2">
                  <p>
                    El acceso a la función de &quot;Live&quot; está sujeto a requisitos de elegibilidad (mínimo de 1,000 seguidores u otorgamiento de estatus de verificación por parte de Viroklipz).
                  </p>
                  <p>
                    Viroklipz se reserva el derecho de monitorear, interrumpir o finalizar cualquier transmisión en vivo que incumpla las normas de la comunidad.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  7. Limitación de Responsabilidad
                </h4>
                <p>
                  Viroklipz es una plataforma tecnológica en desarrollo. No nos hacemos responsables por interrupciones del servicio, fallos de conexión a internet, pérdida de datos, o el comportamiento de otros usuarios (incluyendo estafas externas).
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  8. Ley Aplicable y Jurisdicción
                </h4>
                <p>
                  Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Cualquier disputa legal se resolverá en los tribunales competentes de Venezuela, sin perjuicio de las protecciones que las leyes internacionales (como el RGPD en Europa) otorguen a los consumidores.
                </p>
              </section>
            </>
          ) : (
            <>
              <header className="p-4 rounded-2xl bg-[#161926] border border-white/10 space-y-1">
                <h3 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white">
                  POLÍTICA DE PRIVACIDAD DE VIROKLIPZ
                </h3>
                <p className="text-xs font-medium text-[#00B4D8]">
                  Última actualización: Noviembre 2026
                </p>
              </header>

              <p>
                En Viroklipz (un emprendimiento tecnológico), tu privacidad es fundamental. Esta política explica cómo recopilamos, usamos y protegemos tu información, cumpliendo con estándares internacionales (RGPD/CCPA) y las leyes venezolanas.
              </p>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  1. Información que Recopilamos
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>
                    <strong className="font-semibold text-white">Datos de Registro:</strong> Nombre, apellido, país, edad, correo electrónico y contraseña.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Datos del Perfil:</strong> Foto de perfil, descripción y enlaces personales.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Contenido:</strong> Videos, audios, comentarios y mensajes de chat que publicas en la Plataforma.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Transacciones:</strong> Registro de compras de monedas virtuales (no almacenamos números de tarjetas de crédito ni claves bancarias, esto lo maneja VEX Pay).
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Datos Técnicos:</strong> Dirección IP, tipo de dispositivo, país de conexión y datos de uso del feed (para algoritmos de recomendación).
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  2. Cookies y Almacenamiento Local (PWA)
                </h4>
                <p>
                  Dado que Viroklipz es una Aplicación Web Progresiva (PWA), utilizamos tecnologías como IndexedDB, caché del navegador y Service Workers.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>
                    Estas herramientas permiten que la app funcione rápido sin consumir datos excesivos.
                  </li>
                  <li>
                    Almacenamos localmente tu preferencia de &quot;Ahorro de datos&quot;, los videos en caché para reproducción offline y tus borradores.
                  </li>
                  <li>
                    Puedes borrar estos datos en cualquier momento desde la configuración de tu navegador.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  3. Cómo Usamos tu Información
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>Para autenticar tu cuenta y permitirte publicar contenido.</li>
                  <li>Para mostrar tu contenido a otros usuarios y permitir interacciones (likes, regalos, mensajes).</li>
                  <li>Para personalizar el algoritmo del Feed principal (&quot;Para ti&quot;) según tus intereses.</li>
                  <li>Para procesar pagos y prevenir fraudes financieros a través de nuestros proveedores.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  4. Terceros y Transferencia de Datos
                </h4>
                <p>
                  Para operar, Viroklipz utiliza proveedores en la nube de primer nivel:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>
                    <strong className="font-semibold text-white">Google Firebase:</strong> Almacenamiento seguro de base de datos y autenticación.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Cloudflare Stream:</strong> Para la distribución de transmisiones en vivo.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">VEX Pay:</strong> Para el procesamiento seguro de pagos (Pago Móvil y Cripto).
                  </li>
                </ul>
                <p>
                  Tus datos pueden ser transferidos y almacenados en servidores ubicados en Estados Unidos o Europa. Nos aseguramos de que estos proveedores cumplan con estrictas normas de seguridad.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  5. Menores de Edad (Protección Especial)
                </h4>
                <p>
                  No recopilamos datos de menores de 18 años sin el consentimiento de un representante legal. Si un tutor autoriza la creación de una cuenta, los datos del tutor (nombre, cédula y correo) se almacenan de forma segura y aislada.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  6. Tus Derechos (GDPR y CCPA)
                </h4>
                <p>Como usuario, tienes derecho a:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
                  <li>
                    <strong className="font-semibold text-white">Acceder:</strong> Saber qué datos tenemos sobre ti.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Rectificar:</strong> Corregir tu información.
                  </li>
                  <li>
                    <strong className="font-semibold text-white">Eliminar (Derecho al Olvido):</strong> Puedes eliminar tu cuenta y todos tus videos en cualquier momento desde la opción &quot;Eliminar cuenta&quot; en tu perfil. Al hacerlo, tus datos personales serán borrados de nuestros servidores (Firebase).
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-display text-sm sm:text-base font-bold text-white">
                  7. Seguridad de los Datos
                </h4>
                <p>
                  Utilizamos cifrado en tránsito (HTTPS) y reglas de seguridad en Firestore para garantizar que solo tú puedas modificar tu perfil y que nadie pueda acceder a tus datos privados.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-white/10 bg-[#131622] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-neon-cta text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
