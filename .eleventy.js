module.exports = function(eleventyConfig) {
  // Копировать ассеты
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("api");

  // Указываем, что .html файлы должны обрабатываться как Nunjucks
  eleventyConfig.addExtension("html", {
    key: "njk", // Используем 'njk' как расширение для обработки HTML
    engine: "html",
    // Здесь можно добавить другие опции Nunjucks, если понадобятся
  });

  // Указываем, что по умолчанию Nunjucks используется для всех файлов без явного Front Matter
  // Это не всегда нужно, но часто помогает
  // eleventyConfig.setTemplateFormats(["html", "njk", "md"]);

  // Или, что более просто и часто работает:
  eleventyConfig.addGlobalData("eleventyComputed.permalink", function() {
    return (data) => `${data.page.filePathStem}.html`;
  });


  // Возвращаем конфигурацию
  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    // Указываем, что по умолчанию HTML-файлы обрабатываются как Nunjucks
    htmlTemplateEngine: "njk", 
    dataTemplateEngine: "njk" 
  };
};
