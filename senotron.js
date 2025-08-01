const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, Events
} = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

const token = "TOKEN";
const qeydiyyatRol = "QEYDIYATLI_ROL_ID";
const qeydsizRol = "QEYDIYATSIZ_ROL_ID";
const logKanal = "LOG_KANAL";
const supheliKanal = "SUPHELİ_İSTİFADECİ_LOG";
const adminRol = "ADMİN_ROL";
const geminiKey = "GEMİNİ_KEY";
const apiURL = "https://s10qeydiyyat.vercel.app/check";

const qeydiyyatCəhdləri = {};
const adminTəsdiqdəOlanlar = new Set();
const userLogMessages = {};
const namesState = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.content === "!panel") {
    const disabled = adminTəsdiqdəOlanlar.has(msg.author.id);
    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📋 Qeydiyyat Paneli")
      .setDescription("**Serverə xoş gəlmisiniz!**\nAşağıda qeydiyyat prosesi haqqında bütün məlumatları tapa bilərsiniz.")
      .addFields(
        { name: "🔹 Qeydiyyat Prosesi", value: "1. 'Qeydiyyatdan keç' düyməsinə basın\n2. Açılan formada tam adınızı daxil edin\n3. Sistem adınızı avtomatik yoxlayacaq\n4. Uyğun olarsa qeydiyyat tamamlanacaq" },
        { name: "🔹 Diqqət Edilməli Məqamlar", value: "• Adınızı düzgün daxil edin (Nümunə: Əli)\n• Maksimum 2 cəhd hüququnuz var\n• Uyğunsuz ad və ya 7 gündən az hesab admin təsdiqi tələb edir" }
      )
      .setFooter({ text: "Baku | Qeydiyyat Sistemi | @senotron" });

    const button = new ButtonBuilder()
      .setCustomId("qeydiyyat")
      .setLabel("✅ Qeydiyyatdan keç")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
      .setEmoji("📝");

    const row = new ActionRowBuilder().addComponents(button);
    msg.channel.send({ embeds: [embed], components: [row] });
  }

    if (msg.content === "!adlar") {
      if (!msg.member.roles.cache.has(adminRol)) {
        return msg.reply("Bu əmri istifadə etmək üçün admin olmalısınız!");
      }

      await msg.guild.members.fetch();
      const members = [...msg.guild.members.cache.values()].filter(member => !member.user.bot);


      const state = {
        allMembers: members,
        filteredMembers: members,
        currentPage: 0,
        perPage: 10,
        totalPages: Math.ceil(members.length / 10),
        searchTerm: ""
      };

      const embed = createNamesEmbed(state);
      const buttons = createNamesButtons(state, "TEMP");

      const sentMessage = await msg.channel.send({ 
        embeds: [embed],
        components: [buttons] 
      });

      state.messageId = sentMessage.id;
      namesState.set(sentMessage.id, state);

      sentMessage.edit({ 
        components: [createNamesButtons(state, sentMessage.id)] 
      });
    }
  });

  function createNamesEmbed(state) {
    const start = state.currentPage * state.perPage;
    const end = Math.min(start + state.perPage, state.filteredMembers.length);
    const pageMembers = state.filteredMembers.slice(start, end);

    const description = pageMembers.length > 0 
      ? pageMembers.map((m, i) => {
          const num = start + i + 1;
          const nickname = m.nickname ? ` (${m.nickname})` : '';
          return `**${num}.** <@!${m.id}> - \`${m.user.username}\`${nickname}`;
        }).join('\n')
      : "Heç bir istifadəçi tapılmadı.";

    const embed = new EmbedBuilder()
      .setTitle("📊 İstifadəçi Siyahısı")
      .setColor("#3498db")
      .setDescription(description)
      .setFooter({ 
        text: `Səhifə ${state.currentPage + 1}/${state.totalPages || 1} | Ümumi: ${state.filteredMembers.length} istifadəçi` 
      });

    if (state.searchTerm) {
      embed.addFields({ name: "🔍 Axtarış", value: `\`${state.searchTerm}\`` });
    }

    return embed;
  }

  function createNamesButtons(state, messageId) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`names_prev_${messageId}`)
        .setLabel("◀️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state.currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`names_next_${messageId}`)
        .setLabel("▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state.currentPage >= state.totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`names_search_${messageId}`)
        .setLabel("🔍 Axtarış")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`names_reset_${messageId}`)
        .setLabel("🔄 Sıfırla")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(state.filteredMembers.length === state.allMembers.length)
    );
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith("names_")) {
      const [action, messageId] = interaction.customId.split("_").slice(1);
      const state = namesState.get(messageId);

      if (!state) {
        return interaction.reply({
          content: "Bu siyahının vaxtı bitib. Yenisini yaradın.",
          ephemeral: true
        });
      }

      if (!interaction.member.roles.cache.has(adminRol)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("❌ İcazə Yoxdur")
              .setDescription("Bu əməliyyatı yerinə yetirmək üçün admin olmalısınız.")
          ],
          ephemeral: true
        });
      }

      if (action === "prev") {
        state.currentPage--;
      } 
      else if (action === "next") {
        state.currentPage++;
      }
      else if (action === "reset") {
        state.filteredMembers = state.allMembers;
        state.currentPage = 0;
        state.searchTerm = "";
        state.totalPages = Math.ceil(state.filteredMembers.length / state.perPage);
      }
      else if (action === "search") {
        const modal = new ModalBuilder()
          .setCustomId(`names_search_modal:${messageId}`)
          .setTitle("İstifadəçi Axtarışı");

        const input = new TextInputBuilder()
          .setCustomId("search_term")
          .setLabel("ID, istifadəçi adı və ya ləqəb")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("Boş buraxılsa, bütün istifadəçilər göstəriləcək");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
      }

      interaction.update({ 
        embeds: [createNamesEmbed(state)],
        components: [createNamesButtons(state, messageId)] 
      });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("names_search_modal:")) {
      const messageId = interaction.customId.split(":")[1];
      const state = namesState.get(messageId);

      if (!state) {
        return interaction.reply({
          content: "Bu siyahının vaxtı bitib. Yenisini yaradın.",
          ephemeral: true
        });
      }

      const searchTerm = interaction.fields.getTextInputValue("search_term").toLowerCase();
      state.searchTerm = searchTerm;

      if (searchTerm) {
        state.filteredMembers = state.allMembers.filter(m => 
          m.id.includes(searchTerm) || 
          m.user.username.toLowerCase().includes(searchTerm) || 
          (m.nickname && m.nickname.toLowerCase().includes(searchTerm))
        );
      } else {
        state.filteredMembers = state.allMembers;
      }

      state.currentPage = 0;
      state.totalPages = Math.ceil(state.filteredMembers.length / state.perPage) || 1;

      const originalMessage = await interaction.channel.messages.fetch(messageId);
      originalMessage.edit({ 
        embeds: [createNamesEmbed(state)],
        components: [createNamesButtons(state, messageId)] 
      });

      interaction.reply({
        content: `🔍 Axtarış tamamlandı! ${state.filteredMembers.length} nəticə tapıldı.`,
        ephemeral: true
      });
    }


});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "qeydiyyat") {
      if (adminTəsdiqdəOlanlar.has(interaction.user.id)) {
        return interaction.reply({ 
          embeds: [
            new EmbedBuilder()
              .setColor("Orange")
              .setTitle("⏳ Gözləyin")
              .setDescription("❗ Zəhmət olmasa admin təsdiqini gözləyin.")
          ],
          ephemeral: true 
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("qeyd_formu")
        .setTitle("📝 Qeydiyyat Formu");

      const adInput = new TextInputBuilder()
        .setCustomId("ad")
        .setLabel("Tam adınızı daxil edin")
        .setPlaceholder("Nümunə: Sənan")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(25);

      modal.addComponents(new ActionRowBuilder().addComponents(adInput));
      return await interaction.showModal(modal);
    }

    if (id.startsWith("admin_tesdiq_modal_")) {
      if (!interaction.member.roles.cache.has(adminRol)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("❌ İcazə Yoxdur")
              .setDescription("Bu əməliyyatı yerinə yetirmək üçün admin olmalısınız.")
          ],
          ephemeral: true
        });
      }

      const uid = id.split("_")[3];
      const member = await interaction.guild.members.fetch(uid).catch(() => {});
      if (!member) return;

      const currentName = member.nickname || member.user.username;

      const modal = new ModalBuilder()
        .setCustomId(`admin_tesdiq_submit_${uid}`)
        .setTitle("Ad Dəyişikliyi");

      const adInput = new TextInputBuilder()
        .setCustomId("yeni_ad")
        .setLabel("Yeni adı daxil edin")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(currentName)
        .setMaxLength(25);

      modal.addComponents(new ActionRowBuilder().addComponents(adInput));
      return await interaction.showModal(modal);
    }

    if (id.startsWith("qeyd_sil_modal_")) {
      if (!interaction.member.roles.cache.has(adminRol)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("❌ İcazə Yoxdur")
              .setDescription("Bu əməliyyatı yerinə yetirmək üçün admin olmalısınız.")
          ],
          ephemeral: true
        });
      }

      const uid = id.split("_")[3];

      const modal = new ModalBuilder()
        .setCustomId(`qeyd_sil_submit_${uid}`)
        .setTitle("Qeydiyyatın Silinmə Səbəbi");

      const sebebInput = new TextInputBuilder()
        .setCustomId("səbəb")
        .setLabel("Səbəbi daxil edin (məcburidir)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(sebebInput));
      return await interaction.showModal(modal);
    }

    if (id.startsWith("suspicious_remove_")) {
      if (!interaction.member.roles.cache.has(adminRol)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("❌ İcazə Yoxdur")
              .setDescription("Bu əməliyyatı yerinə yetirmək üçün admin olmalısınız.")
          ],
          ephemeral: true
        });
      }

      const uid = id.split("_")[2];
      const data = userLogMessages[uid];
      if (!data) return;

      const modal = new ModalBuilder()
        .setCustomId(`suspicious_remove_submit_${uid}`)
        .setTitle("Rədd Edilmə Səbəbi");

      const sebebInput = new TextInputBuilder()
        .setCustomId("səbəb")
        .setLabel("Səbəbi daxil edin")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(sebebInput));
      return await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "qeyd_formu") {
      let ad = interaction.fields.getTextInputValue("ad").trim();
      ad = ad.charAt(0).toUpperCase() + ad.slice(1).toLowerCase();

      const user = interaction.user;
      const yeni = Date.now() - user.createdTimestamp < 1000 * 60 * 60 * 24 * 7;
      qeydiyyatCəhdləri[user.id] = (qeydiyyatCəhdləri[user.id] || 0) + 1;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Blurple")
            .setTitle("🔍 Yoxlanılır...")
            .setDescription("Qeydiyyat məlumatlarınız yoxlanılır")
            .setFooter({ text: "Bu proses bir neçə saniyə çəkə bilər | @senotron" })
        ],
        ephemeral: true
      });

      let uyğun = false;
      try {
        const cavab = await axios.get(apiURL, { params: { apikey: geminiKey, name: ad } });
        uyğun = cavab?.data?.result === true;
      } catch {}

      if (yeni) uyğun = false;

      const uzv = interaction.guild.members.cache.get(user.id);
      if (uyğun) {
        await uzv.setNickname(ad).catch(() => {});
        await uzv.roles.remove(qeydsizRol).catch(() => {});
        await uzv.roles.add(qeydiyyatRol).catch(() => {});

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Green")
              .setTitle("✅ Qeydiyyat Tamamlandı")
              .setDescription(`Təbriklər! Uğurla qeydiyyatdan keçdiniz.\n**Adınız:** \`${ad}\``)
              .setThumbnail(user.displayAvatarURL())
          ]
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`qeyd_sil_modal_${user.id}`)
            .setLabel("🗑️ Qeydiyyatsız et")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`admin_tesdiq_modal_${user.id}`)
            .setLabel("✏️ Ad dəyiş")
            .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle("✅ Yeni Qeydiyyat")
          .setThumbnail(user.displayAvatarURL())
          .addFields(
            { name: "👤 İstifadəçi", value: user.toString(), inline: true },
            { name: "📛 Ad", value: ad, inline: true },
            { name: "📅 Hesab yaşı", value: yeni ? "Yeni hesab" : "Köhnə hesab", inline: true },
            { name: "📌 Status", value: "✅ Avtomatik təsdiqləndi", inline: false }
          )
          .setFooter({ text: `ID: ${user.id} | made by @senotron` });

        const kanal = interaction.guild.channels.cache.get(logKanal);
        if (kanal) {
          const sentMessage = await kanal.send({ 
            embeds: [embed],
            components: [row] 
          });
          userLogMessages[user.id] = {
            messageId: sentMessage.id,
            channelId: logKanal,
            name: ad,
            isNew: yeni
          };
        }

        return;
      } else {
        if (qeydiyyatCəhdləri[user.id] < 2) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("Orange")
                .setTitle("⚠️ Xəta")
                .setDescription(`Adınız uyğun deyil və ya hesabınız çox yenidir.\n**Yenidən cəhd edin:** ${qeydiyyatCəhdləri[user.id]}/2`)
            ]
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`admin_tesdiq_modal_${user.id}`)
            .setLabel("✅ Təsdiqlə")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🛡️"),
          new ButtonBuilder()
            .setCustomId(`suspicious_remove_${user.id}`)
            .setLabel("❌ Rədd et")
            .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("⚠️ Admin Təsdiqi Tələb Olunur")
          .setThumbnail(user.displayAvatarURL())
          .addFields(
            { name: "👤 İstifadəçi", value: user.toString(), inline: true },
            { name: "📛 Təklif edilən ad", value: ad, inline: true },
            { name: "📅 Hesab yaşı", value: yeni ? "Yeni hesab (<7 gün)" : "Köhnə hesab", inline: true },
            { name: "❗ Səbəb", value: yeni ? "Yeni yaradılmış hesab" : "Uyğunsuz ad", inline: false },
            { name: "🔢 Cəhdlər", value: `${qeydiyyatCəhdləri[user.id]}/2`, inline: false }
          )
          .setFooter({ text: `ID: ${user.id} | made by @senotron` });

        const kanal = interaction.guild.channels.cache.get(supheliKanal);
        if (kanal) {
          const sentMessage = await kanal.send({ 
            embeds: [embed],
            components: [row] 
          });
          userLogMessages[user.id] = {
            messageId: sentMessage.id,
            channelId: supheliKanal,
            name: ad,
            isNew: yeni
          };
        }

        adminTəsdiqdəOlanlar.add(user.id);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setTitle("⏳ Gözləyin")
              .setDescription("Qeydiyyatınız admin təsdiqi gözləyir. Bildiriş alacaqsınız.")
          ]
        });
      }
    }

    if (interaction.customId.startsWith("admin_tesdiq_submit_")) {
      const uid = interaction.customId.split("_")[3];
      const newName = interaction.fields.getTextInputValue("yeni_ad").trim();
      const member = await interaction.guild.members.fetch(uid).catch(() => {});
      if (!member) return;

      const oldName = member.nickname || member.user.username;
      await member.setNickname(newName).catch(() => {});
      adminTəsdiqdəOlanlar.delete(uid);

      if (userLogMessages[uid]) {
        try {
          const channel = await client.channels.fetch(userLogMessages[uid].channelId);
          const message = await channel.messages.fetch(userLogMessages[uid].messageId);

          const newEmbed = EmbedBuilder.from(message.embeds[0])
            .setColor("Green")
            .spliceFields(1, 1, { name: "📛 Ad", value: newName, inline: true })
            .addFields(
              { name: "✏️ Köhnə ad", value: oldName, inline: true },
              { name: "🛡️ Dəyişdirən", value: interaction.user.toString(), inline: true }
            );

          const disabledComponents = message.components.map(row => {
            return new ActionRowBuilder().addComponents(
              row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
            );
          });

          await message.edit({ 
            embeds: [newEmbed], 
            components: disabledComponents 
          });
        } catch {}
      }

      return interaction.reply({ 
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Ad Uğurla Dəyişdirildi")
            .setDescription(`**İstifadəçi:** <@${uid}>\n**Köhnə ad:** ${oldName}\n**Yeni ad:** ${newName}`)
            .setFooter({ text: `Admin: ${interaction.user.username} | made by @senotron` })
        ] 
      });
    }

    if (interaction.customId.startsWith("qeyd_sil_submit_")) {
      const uid = interaction.customId.split("_")[3];
      const sebeb = interaction.fields.getTextInputValue("səbəb").trim();
      const member = await interaction.guild.members.fetch(uid).catch(() => {});
      if (!member) return;

      const user = await client.users.fetch(uid);
      const isNew = Date.now() - user.createdTimestamp < 1000 * 60 * 60 * 24 * 7;
      const oldName = member.nickname || member.user.username;

      await member.roles.remove(qeydiyyatRol).catch(() => {});
      await member.roles.add(qeydsizRol).catch(() => {});
      await member.setNickname(null).catch(() => {});
      adminTəsdiqdəOlanlar.delete(uid);

      if (userLogMessages[uid]) {
        try {
          const channel = await client.channels.fetch(userLogMessages[uid].channelId);
          const message = await channel.messages.fetch(userLogMessages[uid].messageId);

          const newEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Qeydiyyat Silindi")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: "👤 İstifadəçi", value: `<@${uid}>`, inline: true },
              { name: "📛 Ad", value: oldName, inline: true },
              { name: "📅 Hesab yaşı", value: isNew ? "Yeni hesab" : "Köhnə hesab", inline: true },
              { name: "🗑️ Səbəb", value: sebeb, inline: false },
              { name: "🛡️ Admin", value: interaction.user.toString(), inline: true }
            )
            .setFooter({ text: `ID: ${uid} | made by @senotron` });

          const disabledComponents = message.components.map(row => {
            return new ActionRowBuilder().addComponents(
              row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
            );
          });

          await message.edit({ 
            embeds: [newEmbed], 
            components: disabledComponents 
          });
        } catch {}
      }

      return interaction.reply({ 
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("✅ Qeydiyyat Silindi")
            .setDescription(`**İstifadəçi:** <@${uid}>\n**Ad:** ${oldName}\n**Səbəb:** ${sebeb}`)
            .setFooter({ text: `Admin: ${interaction.user.username} | made by @senotron` })
        ],
        ephemeral: true 
      });
    }

    if (interaction.customId.startsWith("suspicious_remove_submit_")) {
      const uid = interaction.customId.split("_")[3];
      const sebeb = interaction.fields.getTextInputValue("səbəb").trim();
      adminTəsdiqdəOlanlar.delete(uid);

      if (userLogMessages[uid]) {
        try {
          const channel = await client.channels.fetch(userLogMessages[uid].channelId);
          const message = await channel.messages.fetch(userLogMessages[uid].messageId);
          const data = userLogMessages[uid];

          const newEmbed = new EmbedBuilder()
            .setColor("Grey")
            .setTitle("🚫 Təsdiqlənmədi")
            .setThumbnail(message.embeds[0].thumbnail.url)
            .addFields(
              { name: "👤 İstifadəçi", value: `<@${uid}>`, inline: true },
              { name: "📛 Ad", value: data.name, inline: true },
              { name: "📅 Hesab", value: data.isNew ? "Yeni hesab" : "Köhnə hesab", inline: true },
              { name: "❗ Səbəb", value: sebeb, inline: false },
              { name: "🛡️ Admin", value: interaction.user.toString(), inline: true }
            )
            .setFooter({ text: `ID: ${uid}` });

          const disabledComponents = message.components.map(row => {
            return new ActionRowBuilder().addComponents(
              row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
            );
          });

          await message.edit({ 
            embeds: [newEmbed], 
            components: disabledComponents 
          });
        } catch {}
      }

      return interaction.reply({ 
        embeds: [
          new EmbedBuilder()
            .setColor("Grey")
            .setTitle("✅ Əməliyyat Tamamlandı")
            .setDescription("İstifadəçi qeydiyyatı rədd edildi")
        ],
        ephemeral: true 
      });
    }
  }
});

client.login(token);
