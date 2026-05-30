import { Icon, type IconName } from '@/components/Icon'

interface HelperProps {
  tip: string
  name?: IconName
}

function Helper({ tip, name = 'CircleHelp' }: HelperProps) {
  return (
    <span
      data-rp-tooltip={tip}
      className='inline-flex translate-y-[2px] cursor-help text-fg-muted hover:text-fg'
    >
      <Icon name={name} size={16} />
    </span>
  )
}

interface SectionProps {
  id: string
  icon: IconName
  title: string
  children: React.ReactNode
}

function Section({ id, icon, title, children }: SectionProps) {
  return (
    <section id={id} className='space-y-3'>
      <h2 className='flex items-center gap-2 border-b border-border pb-2 text-lg font-semibold text-fg'>
        <Icon name={icon} size={20} />
        {title}
      </h2>
      <div className='space-y-3 text-sm leading-relaxed text-fg'>{children}</div>
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-fg'>
      {children}
    </kbd>
  )
}

export default function Documentation() {
  return (
    <div className='mx-auto max-w-3xl px-6 py-10'>
      <header className='mb-8 space-y-2'>
        <h1 className='flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg'>
          <Icon name='BookOpen' size={24} />
          Documentation RainPath
        </h1>
        <p className='text-sm text-fg-muted'>
          Guide rapide des concepts et fonctionnalités de l&apos;éditeur visuel de workflows de
          relance patient.
        </p>
      </header>

      <nav className='mb-10 rounded-md border border-border bg-surface-muted/40 p-4 text-sm'>
        <p className='mb-2 font-medium text-fg'>Sommaire</p>
        <ul className='grid grid-cols-1 gap-1 text-fg-muted sm:grid-cols-2'>
          <li>
            <a href='#overview' className='hover:text-fg'>
              1. Vue d&apos;ensemble
            </a>
          </li>
          <li>
            <a href='#editor' className='hover:text-fg'>
              2. Éditeur de workflows
            </a>
          </li>
          <li>
            <a href='#templates' className='hover:text-fg'>
              3. Templates de noeuds
            </a>
          </li>
          <li>
            <a href='#profiles' className='hover:text-fg'>
              4. Profils patients
            </a>
          </li>
          <li>
            <a href='#runs' className='hover:text-fg'>
              5. Parcours patients
            </a>
          </li>
          <li>
            <a href='#outputs' className='hover:text-fg'>
              6. Modes de sortie
            </a>
          </li>
          <li>
            <a href='#shortcuts' className='hover:text-fg'>
              7. Raccourcis clavier
            </a>
          </li>
        </ul>
      </nav>

      <div className='space-y-10'>
        <Section id='overview' icon='Info' title={"Vue d'ensemble RainPath"}>
          <p>
            RainPath est un outil de conception et de simulation de{' '}
            <strong>workflows de relance patient</strong>. Vous y définissez des séquences
            d&apos;actions (emails, SMS, WhatsApp, courriers) déclenchées à partir d&apos;une date
            de début, puis vous simulez leur exécution sur des profils patients réels.
          </p>
          <p>
            L&apos;application s&apos;organise autour de trois espaces&nbsp;: l&apos;
            <em>éditeur de workflows</em>, la liste des <em>profils patients</em>, et les{' '}
            <em>parcours patients</em> qui matérialisent l&apos;exécution d&apos;un workflow pour un
            profil donné.
          </p>
          <p className='text-fg-muted'>
            Le seed de démo charge 5 workflows-types (relance simple, cascade multi-canal,
            segmentation par engagement, suivi postal long terme, ping WhatsApp express), 10
            profils patients avec des combinaisons variées de canaux (du « tout disponible » au
            « zéro canal »), et 10 parcours pré-créés associant les deux pour explorer chaque
            cas de figure sans setup.
          </p>
        </Section>

        <Section id='editor' icon='Workflow' title='Éditeur de workflows'>
          <p>
            L&apos;éditeur est une toile (canvas) sur laquelle vous composez votre séquence à partir
            de templates de noeuds.
          </p>
          <ul className='list-disc space-y-2 pl-5'>
            <li>
              <strong>Drag-drop des templates</strong>{' '}
              <Helper tip='Glissez un template depuis la palette latérale vers le canvas pour créer un nouveau noeud.' />{' '}
              — les templates disponibles apparaissent dans la palette à gauche, glissez-les sur la
              toile pour les instancier.
            </li>
            <li>
              <strong>Drag des noeuds pour ajuster les délais</strong>{' '}
              <Helper
                tip={"La position horizontale d'un noeud correspond à son délai (J+n) depuis la date de début."}
              />{' '}
              — la position horizontale d&apos;un noeud encode le délai depuis J+0. Faites-le
              glisser sur la timeline pour modifier le <code>daysAfter</code> de l&apos;arête
              entrante.
            </li>
            <li>
              <strong>Validation continue</strong>{' '}
              <Helper tip='Le workflow est validé à chaque modification ; les erreurs et avertissements apparaissent dans la bannière en haut.' />{' '}
              — le workflow est validé après chaque modification. Les erreurs bloquent la
              sauvegarde, les avertissements sont signalés sans bloquer.
            </li>
            <li>
              <strong>Sauvegarde automatique</strong> — les modifications sont persistées
              automatiquement après une courte période d&apos;inactivité (statut visible dans la
              barre du haut).
            </li>
          </ul>
        </Section>

        <Section id='templates' icon='Boxes' title='Templates de noeuds'>
          <p>
            Chaque noeud du workflow est une instance d&apos;un <strong>template</strong>. Quatre
            familles sont disponibles&nbsp;:
          </p>
          <ul className='list-disc space-y-2 pl-5'>
            <li>
              <Icon name='Mail' size={16} className='mr-1 inline align-middle' />
              <strong>Email</strong> — envoi d&apos;un email transactionnel (sujet + corps avec
              variables de personnalisation).
            </li>
            <li>
              <Icon name='MessageSquare' size={16} className='mr-1 inline align-middle' />
              <strong>SMS</strong> — envoi d&apos;un SMS court.
            </li>
            <li>
              <Icon name='MessageCircle' size={16} className='mr-1 inline align-middle' />
              <strong>WhatsApp</strong> — envoi d&apos;un message WhatsApp via l&apos;API
              officielle.
            </li>
            <li>
              <Icon name='Mailbox' size={16} className='mr-1 inline align-middle' />
              <strong>Postal</strong>{' '}
              <Helper
                tip={"Le courrier postal a un drapeau « suivi » : un courrier suivi expose les statuts delivered/returned, un non-suivi reste à sent (pas d'accusé)."}
              />{' '}
              — envoi d&apos;un courrier papier physique. Drapeau{' '}
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>tracked</code>{' '}
              pour distinguer suivi (statuts delivered / returned observables) et non suivi
              (statut sent uniquement).
            </li>
          </ul>
          <p className='text-fg-muted'>
            Les branchements dynamiques se font via le <strong>mode multi</strong> des noeuds
            d&apos;envoi (voir « Modes de sortie » plus bas).
          </p>
        </Section>

        <Section id='profiles' icon='Users' title='Profils patients'>
          <p>
            Un profil patient regroupe les données d&apos;identité et les{' '}
            <strong>coordonnées par canal</strong>. La présence (ou non) de chaque coordonnée
            détermine quelles branches d&apos;un workflow sont jouables&nbsp;: sans email, un
            nœud d&apos;envoi email ne propose que sa sortie échec.
          </p>
          <ul className='list-disc space-y-2 pl-5'>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>firstName</code>
              {' / '}
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>lastName</code> —
              prénom et nom (obligatoires).
            </li>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>gender</code>{' '}
              <Helper tip='Champ male / female, utilisé pour les accords dans les messages personnalisés.' />{' '}
              — accords dans les messages personnalisés.
            </li>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>email</code> —
              coordonnée pour les nœuds <strong>email</strong>.
            </li>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>phone</code> —
              numéro mobile pour les nœuds <strong>SMS</strong>.
            </li>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>whatsapp</code> —
              numéro WhatsApp (peut être identique à <code>phone</code>, ou différent).
            </li>
            <li>
              <code className='rounded bg-surface-muted px-1 py-0.5 text-xs'>address</code>{' '}
              <Helper tip={"Adresse structurée { street, postalCode, city, country? }. Le code postal vit dans cet objet — il n'y a plus de champ postalCode séparé."} />{' '}
              — adresse postale structurée pour les nœuds <strong>courrier</strong>{' '}
              ({'{ street, postalCode, city, country? }'}).
            </li>
          </ul>
        </Section>

        <Section id='runs' icon='Play' title='Parcours patients'>
          <p>
            Un <strong>parcours</strong> (ou <em>patient run</em>) matérialise l&apos;exécution
            d&apos;un workflow pour un profil patient donné, à partir d&apos;une date de début.
          </p>
          <ul className='list-disc space-y-2 pl-5'>
            <li>
              <strong>Date de début (J+0)</strong>{' '}
              <Helper tip='Le J+0 est la date de référence à partir de laquelle tous les délais daysAfter sont calculés.' />{' '}
              — sert d&apos;origine pour calculer les dates planifiées des nœuds.
            </li>
            <li>
              <strong>Curseur J+N temporel</strong>{' '}
              <Helper tip='Ligne pointillée verticale + pill J+N qui se cale sur le nœud focalisé. Visible dès J+0.' />{' '}
              — une ligne pointillée verticale traverse le canvas à la hauteur du nœud
              focalisé, repérée par une pill J+N.
            </li>
            <li>
              <strong>Sélecteur de statut inline</strong>{' '}
              <Helper tip={"Sur chaque nœud d'envoi actionnable, choisissez le statut observé (delivered, opened, bounced...) avant de cliquer « Prochain ». Le statut détermine la branche empruntée."} />{' '}
              — sur le nœud courant (et chaque frontière parallèle), un sélecteur propose les
              statuts routables, groupés en sortie succès / sortie échec.
            </li>
            <li>
              <strong>Avertissements coordonnées</strong>{' '}
              <Helper tip='Une icône warning à côté du label « Statut observé » signale que les coordonnées du canal manquent ou que les sorties ne sont pas reliées. Survolez pour le détail.' />{' '}
              — quand les coordonnées du canal manquent au profil ou qu&apos;aucune sortie
              n&apos;est routable, une icône signale la cause exacte (tooltip au survol).
            </li>
            <li>
              <strong>Branches parallèles</strong>{' '}
              <Helper tip='Les workflows multi-output peuvent avoir plusieurs nœuds actionnables simultanément ; cliquez sur une carte pour focaliser cette branche.' />{' '}
              — les workflows multi-sortie ouvrent plusieurs frontières simultanées. Cliquer
              sur une carte focalise sa branche, le J+N suit.
            </li>
            <li>
              <strong>Auto-pilote chronologique</strong>{' '}
              <Helper tip={"« Prochain » chaîne tous les nœuds dont le statut a déjà été pré-pioché, dans l'ordre chronologique, jusqu'à atteindre un nœud sans choix."} />{' '}
              — « Prochain » avance automatiquement tant que les nœuds actionnables ont un
              statut pré-sélectionné, puis s&apos;arrête au premier qui demande une décision.
            </li>
            <li>
              <strong>Panneau latéral repliable</strong> — profil patient + historique daté
              (date effective, statut observé) côté droit, repliable via le chevron pour
              maximiser le canvas.
            </li>
          </ul>
        </Section>

        <Section id='outputs' icon='Split' title='Modes de sortie'>
          <p>
            Chaque noeud d&apos;envoi (email, SMS, WhatsApp, postal) possède un{' '}
            <strong>mode de sortie</strong> qui décrit combien d&apos;arêtes sortantes il peut
            avoir.
          </p>
          <ul className='list-disc space-y-2 pl-5'>
            <li>
              <strong>Simple</strong>{' '}
              <Helper tip={"Deux handles implicites : « success » et « failure ». Vous listez les statuts qui comptent comme succès — les statuts d'échec du canal (bounced, failed, returned…) routent automatiquement sur failure."} />{' '}
              — deux sorties implicites <em>succès</em> et <em>échec</em>. Vous définissez les
              statuts qui comptent comme succès ; les statuts d&apos;échec propres au canal
              (bounced, failed, returned…) routent automatiquement sur l&apos;échec.
            </li>
            <li>
              <strong>Multi</strong>{' '}
              <Helper tip='Plusieurs sorties nommées (ex. engagé / pas engagé / échec), chacune avec son propre identifiant et son jeu de statuts déclencheurs.' />{' '}
              — plusieurs sorties nommées (par exemple <em>engagé</em> / <em>pas engagé</em>{' '}
              / <em>échec</em>). Chaque sortie a son propre identifiant et un jeu de statuts
              qui la déclenchent ; un statut ne peut appartenir qu&apos;à une seule sortie.
            </li>
          </ul>
        </Section>

        <Section id='shortcuts' icon='Keyboard' title='Raccourcis clavier'>
          <p>Dans l&apos;éditeur de workflow&nbsp;:</p>
          <ul className='space-y-2'>
            <li className='flex flex-wrap items-center gap-2'>
              <span className='flex items-center gap-1'>
                <Kbd>Cmd</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>
              </span>
              <span>— Sauvegarder maintenant</span>
              <Helper tip="Force une sauvegarde immédiate, même si le débounce auto-save n'a pas encore déclenché." />
            </li>
            <li className='flex flex-wrap items-center gap-2'>
              <span className='flex items-center gap-1'>
                <Kbd>Cmd</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>Z</Kbd>
              </span>
              <span>— Annuler la dernière action (undo)</span>
            </li>
            <li className='flex flex-wrap items-center gap-2'>
              <span className='flex items-center gap-1'>
                <Kbd>Cmd</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd>
              </span>
              <span>— Rétablir (redo)</span>
            </li>
            <li className='flex flex-wrap items-center gap-2'>
              <span className='flex items-center gap-1'>
                <Kbd>Cmd</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>Y</Kbd>
              </span>
              <span>— Rétablir (redo, alternative)</span>
            </li>
            <li className='flex flex-wrap items-center gap-2'>
              <span className='flex items-center gap-1'>
                <Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd>
              </span>
              <span>
                — Supprimer le noeud ou l&apos;arête sélectionné(e)
              </span>
              <Helper tip='Désactivé lorsque le focus est dans un champ texte pour ne pas interférer avec édition.' />
            </li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
