module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("api");

  eleventyConfig.addExtension("html", {
    key: "njk", 
    engine: "html",
  });

  eleventyConfig.addGlobalData("eleventyComputed.permalink", function() {
    return (data) => `${data.page.filePathStem}.html`;
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    htmlTemplateEngine: "njk", 
    dataTemplateEngine: "njk" 
  };
};
