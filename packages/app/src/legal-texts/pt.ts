import type { LegalTexts } from "./types";

/** Política de privacidade e termos de uso em português. */
export const pt: LegalTexts = {
  missing: "a ser publicado nesta página",
  address: "Cuernavaca, Morelos, México",
  privacy: (o) => ({
    title: "Política de privacidade",
    intro:
      "Esta política explica quais informações o TuEventoFun trata para que você possa criar eventos, enviar convites privados e saber quem vai comparecer.",
    sections: [
      {
        title: "Quem é responsável",
        body: [
          `Titular do serviço: ${o.name}.`,
          `Endereço: ${o.address}.`,
          `Contato de privacidade: ${o.contact}.`,
        ],
      },
      {
        title: "Informações da sua conta",
        body: [
          "Ao se cadastrar, guardamos seu nome e sobrenome, e-mail, telefone e uma senha protegida com scrypt (nunca a guardamos em texto simples). Também guardamos o idioma do domínio pelo qual você entra: cada idioma tem o seu próprio domínio. Escrevemos para você nesse idioma e a partir desse domínio.",
          "Se você enviar um avatar ou logo, nós o reduzimos para 256 × 256 pixels e guardamos apenas essa cópia.",
          "Se você entrar com o Google, recebemos e verificamos seu nome, e-mail e identificador da conta Google. Não recebemos sua senha do Google.",
        ],
      },
      {
        title: "Para que usamos suas informações",
        body: [
          "Para prestar o serviço que você pede: criar e manter sua conta, permitir que você entre e recupere o acesso, guardar seus eventos e convites, mostrar a cada convidado o seu convite, registrar as respostas e avisar você. Também as usamos para manter a segurança do serviço e evitar abusos.",
          "Somente se você assinar a newsletter: para enviar ideias e novidades do TuEventoFun. Essa finalidade é opcional; não assinar, ou cancelar a inscrição, não afeta sua conta.",
        ],
      },
      {
        title: "Informações dos seus convidados",
        body: [
          "Em cada evento você pode adicionar convites com nome, e-mail, telefone e notas privadas, além do nome de cada integrante, se é adulto ou criança e suas notas. As notas e os dados de contato só você vê; a página do convite mostra aos convidados apenas seus nomes e os dados do evento.",
          "Os convidados respondem sem criar uma conta. Guardamos a resposta de cada integrante (confirmado, não vai ou pendente) e avisamos você.",
          "Você é responsável por ter a permissão dos seus convidados para adicionar os dados deles.",
          "Se você compartilhar um link genérico, quem se cadastra preenche os próprios dados e os das pessoas que vêm com ela. Você vê esses dados, como os das demais respostas.",
        ],
      },
      {
        title: "Cartão postal e endereço público do evento",
        body: [
          "O cartão postal de cada evento pode incluir até duas fotos que você envia. Antes de salvá-las, removemos os metadados, como o local onde foram tiradas, giramos conforme a orientação e reduzimos para no máximo 2048 pixels.",
          "As fotos do cartão postal são mostradas a quem tiver o convite ou o endereço público do evento. Cada foto tem um identificador aleatório que não pode ser adivinhado. Você pode remover uma foto a qualquer momento, e ao apagar o evento as fotos também são apagadas.",
          "Se você der um endereço público ao evento, quem o tiver verá o título, a descrição, a data, o local, o nome do anfitrião e o cartão postal. Seus convidados, os dados de contato e as respostas nunca são mostrados. Você pode remover ou trocar o endereço a qualquer momento, e ele deixa de aparecer se arquivar o evento.",
          "Guardamos até 20 versões anteriores do cartão postal para que você possa voltar a elas. Elas são apagadas ao apagar o evento.",
          "Você pode proteger a página pública com uma senha. Guardamos apenas uma marca (hash) da senha e do acesso que ela concede, que expira em 24 horas. O calendário baixado (.ics) contém apenas os dados do evento.",
        ],
      },
      {
        title: "Sessões e armazenamento no seu dispositivo",
        body: [
          "Usamos um cookie de sessão que os scripts não podem ler (HttpOnly) e que dura 7 dias, e um cookie temporário de 5 minutos para verificar o acesso com o Google. Não usamos cookies de publicidade.",
          "Nos apps móveis, o idioma que você escolhe fica guardado no seu dispositivo.",
          "Para contar visitas, o navegador mantém um identificador aleatório anônimo. Registramos o tipo de página (início, downloads ou painel), a plataforma (web, Android ou iOS) e a data. Não registramos seu endereço IP, links de convite nem dados de contato nessas métricas.",
          "Se a análise com Umami estiver ativada neste site, a página também carrega o script dele para medir visitas de forma agregada.",
          "Como qualquer site, nossos servidores guardam registros técnicos de acesso, que incluem o endereço IP, por segurança e funcionamento.",
        ],
      },
      {
        title: "E-mails que enviamos",
        body: [
          "Se você pedir para redefinir sua senha, enviamos um link que funciona uma única vez e expira em 60 minutos; guardamos apenas uma impressão (hash) desse link. Quando a senha muda, encerramos todas as sessões abertas e enviamos um aviso de segurança.",
          "Esses e-mails são enviados no idioma do domínio que você usou, a partir desse domínio, por meio de um provedor de envio de e-mails que recebe apenas o necessário para entregá-los.",
          "Avisamos por e-mail quando alguém responde ou se cadastra no seu evento, e quando você muda a data, o local ou cancela o evento. Aos convidados que deixaram o e-mail enviamos a confirmação da resposta e esses avisos. Usamos esse e-mail apenas para isso.",
        ],
      },
      {
        title: "Newsletter",
        body: [
          "A newsletter é opcional e independente da sua conta. Se você assinar, guardamos seu e-mail, o nome que você nos der e o idioma do domínio onde se inscreveu.",
          "Nós a gerenciamos com o Listmonk, uma ferramenta de envio própria, no subdomínio news. do domínio de cada idioma. Você receberá um e-mail para confirmar a inscrição, e cada envio inclui um link para cancelá-la a qualquer momento.",
        ],
      },
      {
        title: "Onde as informações ficam guardadas e por quanto tempo",
        body: [
          "As fotos dos cartões postais ficam no disco do servidor, em um volume próprio separado do banco de dados. São mantidas enquanto o evento existir.",
          "Os dados ficam guardados em um banco de dados PostgreSQL nos servidores do serviço.",
          "Seus eventos, convites e respostas são mantidos até que você os exclua. Excluir um evento ou um convite apaga também os convidados e as respostas dele.",
          "Os registros de visitas e acessos são apagados após 90 dias. Os espaços de demonstração são apagados após 7 dias. As sessões e os links de recuperação expirados são eliminados automaticamente.",
          "As inscrições na newsletter são mantidas até que você cancele a inscrição ou nos peça para apagá-las.",
        ],
      },
      {
        title: "Com quem compartilhamos",
        body: [
          "Não vendemos nem alugamos suas informações. Quando você compartilha um convite pelo WhatsApp ou por e-mail, ele é enviado pelo seu próprio app ou programa de e-mail, sob as condições deles.",
          "O Google só participa se você escolher entrar com o Google.",
          "Para entregar nossos e-mails usamos um provedor de envio de e-mails, que age em nosso nome e não pode usar suas informações para outra finalidade.",
        ],
      },
      {
        title: "Apps móveis",
        body: [
          "Os apps para Android e iOS usam a mesma conta e as mesmas informações descritas aqui.",
        ],
      },
      {
        title: "Seus direitos",
        body: [
          "Você pode ver e corrigir seu perfil na sua conta a qualquer momento, além de excluir seus eventos e convites.",
          `Para exercer seus direitos de acesso, retificação, cancelamento ou oposição, revogar seu consentimento ou encerrar sua conta, escreva para o contato de privacidade: ${o.contact}. Informe o e-mail da sua conta e o que você precisa; responderemos nos prazos previstos pela lei mexicana.`,
        ],
      },
      {
        title: "Alterações nesta política",
        body: [
          "Se esta política mudar, publicaremos a nova versão nesta página com a respectiva data.",
        ],
      },
    ],
  }),
  terms: (o) => ({
    title: "Termos de uso",
    intro:
      "Estes termos se aplicam quando você usa o TuEventoFun na web ou nos apps móveis.",
    sections: [
      {
        title: "O serviço",
        body: [
          "O TuEventoFun permite criar eventos, criar convites, compartilhar links privados e acompanhar as respostas pessoa por pessoa. É oferecido por " +
            `${o.name}, com endereço em ${o.address}.`,
        ],
      },
      {
        title: "Sua conta",
        body: [
          "Você deve fornecer informações verdadeiras e proteger sua senha. Você é responsável pela atividade da sua conta.",
          "Se esquecer sua senha, pode pedir um link para escolher uma nova; ele chega ao e-mail da sua conta.",
          "Cada link de convite é privado: quem o tiver pode ver o convite e responder. Compartilhe-o apenas com seus convidados.",
        ],
      },
      {
        title: "Seu conteúdo e seus convidados",
        body: [
          "Os eventos, textos e imagens que você adiciona são seus. Você nos permite guardá-los e exibi-los apenas para prestar o serviço.",
          "Você deve ter a permissão dos seus convidados para adicionar os dados deles e usar o serviço apenas para organizar celebrações reais, sem enviar mensagens indesejadas.",
        ],
      },
      {
        title: "Uso aceitável",
        body: [
          "Não use o serviço para conteúdo ilegal, para se passar por outras pessoas nem para tentar acessar contas ou dados alheios. Podemos suspender as contas que fizerem isso.",
        ],
      },
      {
        title: "Disponibilidade",
        body: [
          "Trabalhamos para que o serviço esteja disponível, mas não podemos garantir que funcione sem interrupções. Os espaços de demonstração são temporários e são apagados após 7 dias.",
        ],
      },
      {
        title: "Alterações e contato",
        body: [
          "Se estes termos mudarem, publicaremos a nova versão nesta página com a respectiva data.",
          `Contato: ${o.contact}.`,
        ],
      },
    ],
  }),
};
