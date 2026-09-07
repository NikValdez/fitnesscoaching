"""Rebuild the branded placeholder PDF; replace with Steve's finished program before launch."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

root = Path(__file__).resolve().parents[1]
target = root / 'output/pdf/69-easy-sample.pdf'
target.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(target), pagesize=(595, 842))
c.setTitle('69 easy - Sample edition')
c.setAuthor('Steve Rossiter Coaching')
navy, paper, muted, ink = '#2e4a7d', '#fbfaf8', '#727773', '#151c24'

def text(x, y, value, size=12, color=ink, font='Helvetica'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def base(page, dark=False):
    c.setFillColor(HexColor(navy if dark else paper)); c.rect(0, 0, 595, 842, fill=1, stroke=0)
    color = paper if dark else navy
    text(48, 784, 'STEVE ROSSITER', 12, color, 'Helvetica-Bold')
    text(48, 767, 'C O A C H I N G', 8, color)
    c.setStrokeColor(HexColor('#6680a9' if dark else '#d9dcd7')); c.line(48, 63, 547, 63)
    text(48, 42, 'SAMPLE EDITION  /  NOT A TRAINING PRESCRIPTION', 8, color)
    text(526, 42, f'{page:02}', 9, color)

base(1, True)
text(48, 640, 'THE PDF PROGRAM', 10, '#d3dceb')
text(43, 514, '69 easy', 92, paper, 'Helvetica-Bold')
text(48, 457, 'Your next chapter starts here.', 21, paper)
text(48, 199, 'Sample edition', 17, paper, 'Helvetica-Bold')
text(48, 171, 'A placeholder document for previewing the purchase', 12, '#d3dceb')
text(48, 152, 'and download experience. The finished program is coming.', 12, '#d3dceb')
c.showPage()

base(2)
text(48, 690, 'A place for your plan.', 32, navy, 'Helvetica-Bold')
text(48, 650, 'This sample confirms that your PDF download works.', 13)
text(48, 628, 'It does not include a workout or nutrition prescription.', 13)
for y, number, title, detail in [
    (536, '01', 'Program overview', 'Steve will add the program goals and guidance here.'),
    (425, '02', 'Training sessions', 'The finished edition will contain the training plan.'),
    (314, '03', 'Progress notes', 'Use the worksheet on the next page to try the layout.'),
]:
    text(48, y, number, 11, navy)
    text(93, y, title, 19, ink, 'Helvetica-Bold')
    text(93, y - 27, detail, 11, muted)
    c.setStrokeColor(HexColor('#d9dcd7')); c.line(48, y - 55, 547, y - 55)
text(48, 134, 'This PDF is separate from individual coaching with Steve.', 11, muted)
c.showPage()

base(3)
text(48, 690, 'Make a note of it.', 32, navy, 'Helvetica-Bold')
text(48, 653, 'A sample worksheet for the finished program.', 13, muted)
for y, heading in [(574, 'MY GOAL'), (413, 'WHAT WENT WELL'), (252, 'WHAT I WANT TO WORK ON')]:
    text(48, y, heading, 9, navy, 'Helvetica-Bold')
    c.setStrokeColor(HexColor('#d9dcd7'))
    for offset in [31, 62, 93]: c.line(48, y - offset, 547, y - offset)
c.showPage(); c.save()
print(target)
