function generateEmailTemplate(
  title,
  formattedStart,
  formattedEnd,
  guestList,
  location,
  description
) {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="
      border: 1px solid #e5e5e5;
      min-width: 624px;
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      font-family: Helvetica;
    ">
      <tbody>
        <tr>
          <td style="
            background-color: #f6f6f6;
            border: 1px solid #e5e5e5;
            padding: 21px;
            vertical-align: top;
            width: 100%;
            max-width: 315px;
            display: block;
          ">
            <div style="
              background: url('https://odseknis.akademijanis.edu.rs/wp-content/uploads/2020/03/Logo-akademije-Nis-2020-e1583448050322.png') no-repeat center center;
              height: 80px;
              width: 100%;
              display: block;
            "></div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="
            width: 100%;
            padding: 21px;
            vertical-align: top;
          ">
            <table cellpadding="0" cellspacing="0" border="0" style="
              width: 100%;
              border-collapse: collapse;
              display: block;
            ">
              <tbody>
                <tr style="display: table-row; margin: 0 0 20px 0;">
                  <td style="
                    color: #222;
                    font-size: 24px;
                    padding: 0 0 20px 0;
                    text-transform: capitalize;
                  ">${title}</td>
                </tr>
                <tr style="display: table-row;">
                  <td style="
                    padding-right: 10px;
                    min-width: 48px;
                    white-space: nowrap;
                    padding-bottom: 6px;
                    color: #999;
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">Kada</td>
                  <td style="
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">${formattedStart} – ${formattedEnd}</td>
                </tr>
                <tr style="display: table-row;">
                  <td style="
                    padding-right: 10px;
                    min-width: 48px;
                    white-space: nowrap;
                    padding-bottom: 6px;
                    color: #999;
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">Ko</td>
                  <td style="
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                    word-spacing: 5px;
                  ">${guestList}</td>
                </tr>
                <tr style="display: table-row;">
                  <td style="
                    padding-right: 10px;
                    min-width: 48px;
                    white-space: nowrap;
                    padding-bottom: 6px;
                    color: #999;
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">Gde</td>
                  <td style="
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">${location}</td>
                </tr>
                <tr style="display: table-row;">
                  <td style="
                    padding-right: 10px;
                    min-width: 48px;
                    white-space: nowrap;
                    padding-bottom: 6px;
                    color: #999;
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">Opis</td>
                  <td style="
                    padding-left: 0;
                    padding-top: 2px;
                    vertical-align: top;
                    word-wrap: break-word;
                  ">${description}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

module.exports = generateEmailTemplate;
